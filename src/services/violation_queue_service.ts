// ==================== VIOLATION OFFLINE QUEUE SERVICE ====================
// Handles violation queuing when offline and syncs when online
// Supports Blob (video/image) proof storage
// Video proofs upload directly, frame images stored in localStorage for offline

interface QueuedViolation {
  id: string;
  type: string;
  details?: string;
  videoProof?: Blob;    // Full video - for online upload only
  frameProof?: Blob;    // Single frame - for localStorage backup
  proofUrl?: string;    // URL after upload
  timestamp: number;
  examId: string;
  studentId: string;
  attemptId: string;
  retryCount: number;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  lastSyncAttempt?: number;
}

interface ViolationSyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  queueLength: number;
  lastSyncTime: number | null;
  failedCount: number;
}

class ViolationQueueService {
  private static instance: ViolationQueueService | null = null;
  private queue: QueuedViolation[] = [];
  private syncInProgress: boolean = false;
  private isOnline: boolean = navigator.onLine;
  private listeners: Array<(status: ViolationSyncStatus) => void> = [];
  
  private readonly STORAGE_KEY = 'exam_violation_queue';
  private readonly BLOB_STORAGE_PREFIX = 'violation_blob_';
  private readonly MAX_RETRY_COUNT = 5; // More retries for violations
  private readonly SYNC_INTERVAL = 12000; // ✅ 12 seconds (offset from answer sync at 5s)
  private readonly MAX_QUEUE_AGE = 48 * 60 * 60 * 1000; // 48 hours
  private syncTimer: number | null = null;
  private syncCallback: ((violation: QueuedViolation) => Promise<boolean>) | null = null;

  // Singleton pattern
  static getInstance(): ViolationQueueService {
    if (!ViolationQueueService.instance) {
      ViolationQueueService.instance = new ViolationQueueService();
    }
    return ViolationQueueService.instance;
  }

  private constructor() {
    this.loadQueueFromStorage();
    this.setupNetworkListeners();
    this.startAutoSync();
  }

  // ==================== INITIALIZATION ====================

  /**
   * Set callback function to save violations to database
   */
  public setSyncCallback(callback: (violation: QueuedViolation) => Promise<boolean>): void {
    this.syncCallback = callback;
    console.log('✅ Violation sync callback registered');
  }

  /**
   * Load queued violations from localStorage
   */
  private loadQueueFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsedQueue: QueuedViolation[] = JSON.parse(stored);
        
        // Filter out stale items (older than 48 hours)
        const now = Date.now();
        const freshQueue = parsedQueue.filter((item) => {
          const age = now - item.timestamp;
          const isStale = age > this.MAX_QUEUE_AGE;
          if (isStale) {
            console.log(`🧹 Removing stale violation (${Math.round(age / 1000 / 60)} minutes old):`, item.type);
            // Clean up associated blob storage
            this.deleteBlobFromStorage(item.id);
          }
          return !isStale;
        });
        
        this.queue = freshQueue;
        console.log(`📦 Loaded ${this.queue.length} queued violations from storage (removed ${parsedQueue.length - freshQueue.length} stale items)`);
        
        // Save cleaned queue back to storage
        if (freshQueue.length !== parsedQueue.length) {
          this.saveQueueToStorage();
        }
      }
    } catch (error) {
      console.error('❌ Error loading violation queue from storage:', error);
      this.queue = [];
    }
  }

  /**
   * Save queue metadata to localStorage (without Blobs)
   */
  private saveQueueToStorage(): void {
    try {
      // Save queue without Blob objects (Blobs stored separately)
      const queueToSave = this.queue.map(v => ({
        ...v,
        videoProof: undefined, // Don't serialize video Blob
        frameProof: undefined, // Don't serialize frame Blob
      }));
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(queueToSave));
    } catch (error) {
      console.error('❌ Error saving violation queue to storage:', error);
    }
  }

  /**
   * Store frame Blob in localStorage (only images, skip videos)
   * Returns true if stored successfully, false if storage full or too large
   */
  private async saveBlobToStorage(id: string, blob: Blob): Promise<boolean> {
    try {
      // Only store images in localStorage - videos are too large
      if (blob.type.includes('video')) {
        console.log(`⏭️ Skipping video blob for localStorage (${(blob.size / 1024 / 1024).toFixed(2)}MB) - will upload directly when online`);
        return false;
      }
      
      // Check if image is too large (skip if > 500KB)
      const MAX_BLOB_SIZE = 500 * 1024; // 500KB for frame images
      if (blob.size > MAX_BLOB_SIZE) {
        console.warn(`⚠️ Frame too large (${(blob.size / 1024).toFixed(0)}KB), skipping localStorage.`);
        return false;
      }
      
      // Convert Blob to Base64
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Read failed"));
      });
      
      // Clear old blobs first to make space (keep only latest 3)
      this.cleanupOldBlobs(3);
      
      // Try to store
      try {
        localStorage.setItem(`${this.BLOB_STORAGE_PREFIX}${id}`, base64);
        console.log(`💾 Saved violation frame for ${id} (${(blob.size / 1024).toFixed(0)}KB)`);
        return true;
      } catch (quotaError) {
        // Storage quota exceeded - clear all blobs and try again
        console.warn('⚠️ localStorage quota exceeded, clearing old blobs...');
        this.cleanupOldBlobs(0); // Clear all
        
        try {
          localStorage.setItem(`${this.BLOB_STORAGE_PREFIX}${id}`, base64);
          console.log(`💾 Saved violation frame for ${id} after cleanup`);
          return true;
        } catch (retryError) {
          console.error('❌ Cannot store frame - localStorage still full');
          return false;
        }
      }
    } catch (error) {
      console.error('❌ Error saving blob to storage:', error);
      return false;
    }
  }
  
  /**
   * Clean up old blobs, keeping only the specified number
   */
  private cleanupOldBlobs(keepCount: number): void {
    try {
      const blobKeys: { key: string; timestamp: number }[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.BLOB_STORAGE_PREFIX)) {
          // Extract timestamp from key format: violation_blob_TYPE_TIMESTAMP_RANDOM
          const parts = key.replace(this.BLOB_STORAGE_PREFIX, '').split('_');
          const timestamp = parseInt(parts[1] || '0');
          blobKeys.push({ key, timestamp });
        }
      }
      
      // Sort by timestamp (oldest first)
      blobKeys.sort((a, b) => a.timestamp - b.timestamp);
      
      // Remove oldest blobs, keeping only keepCount
      const toRemove = blobKeys.slice(0, Math.max(0, blobKeys.length - keepCount));
      toRemove.forEach(({ key }) => {
        localStorage.removeItem(key);
        console.log(`🧹 Removed old blob: ${key}`);
      });
    } catch (error) {
      console.error('❌ Error cleaning up old blobs:', error);
    }
  }

  /**
   * Retrieve Blob from storage
   */
  private async loadBlobFromStorage(id: string): Promise<Blob | null> {
    try {
      const base64 = localStorage.getItem(`${this.BLOB_STORAGE_PREFIX}${id}`);
      if (!base64) return null;

      // Convert Base64 back to Blob
      const response = await fetch(base64);
      return await response.blob();
    } catch (error) {
      console.error('❌ Error loading blob from storage:', error);
      return null;
    }
  }

  /**
   * Delete Blob from storage
   */
  private deleteBlobFromStorage(id: string): void {
    try {
      localStorage.removeItem(`${this.BLOB_STORAGE_PREFIX}${id}`);
    } catch (error) {
      console.error('❌ Error deleting blob from storage:', error);
    }
  }

  /**
   * Setup network event listeners
   * ✅ IMPORTANT: Violations sync AFTER answers to avoid race condition
   */
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      console.log('🌐 Network restored - violations will sync after answers...');
      this.isOnline = true;
      this.notifyListeners();
      // ✅ DELAY: Wait 3 seconds for answer sync to complete first
      // offline_queue_service syncs at 500ms, so 3000ms gives plenty of buffer
      setTimeout(() => {
        console.log('🔄 Starting violation sync (after answer sync window)...');
        this.syncQueue();
      }, 3000);
    });

    window.addEventListener('offline', () => {
      console.log('🔴 Network lost - violations will be queued');
      this.isOnline = false;
      this.notifyListeners();
    });

    // Initial sync if online and has queued items
    // ✅ DELAY: Also delay initial sync to avoid conflict with answer sync
    if (this.isOnline && this.queue.length > 0) {
      setTimeout(() => this.syncQueue(), 4000);
    }
  }

  /**
   * Start automatic sync timer
   */
  private startAutoSync(): void {
    this.syncTimer = window.setInterval(() => {
      if (this.isOnline && this.queue.length > 0 && !this.syncInProgress) {
        this.syncQueue();
      }
    }, this.SYNC_INTERVAL);
  }

  // ==================== QUEUE OPERATIONS ====================

  /**
   * Queue a violation for sync
   * @param type - Violation type
   * @param details - Additional details
   * @param videoProof - Full video blob (for online upload)
   * @param frameProof - Single frame blob (for offline storage)
   * @param examId - Exam ID
   * @param studentId - Student ID
   * @param attemptId - Attempt ID
   */
  public async queueViolation(
    type: string,
    details?: string,
    videoProof?: Blob,
    frameProof?: Blob,
    examId?: string,
    studentId?: string,
    attemptId?: string
  ): Promise<{ success: boolean; message: string; queued: boolean }> {
    const violationId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store frame in localStorage for offline backup (small size)
    if (frameProof) {
      const stored = await this.saveBlobToStorage(violationId, frameProof);
      if (stored) {
        console.log(`💾 Frame stored in localStorage for offline backup`);
      }
    }

    const queueItem: QueuedViolation = {
      id: violationId,
      type,
      details,
      videoProof,      // Keep in memory for immediate upload
      frameProof,      // Keep in memory for immediate upload
      timestamp: Date.now(),
      examId: examId || '',
      studentId: studentId || '',
      attemptId: attemptId || '',
      retryCount: 0,
      status: 'pending',
    };

    // If online and has sync callback, try immediate sync with video
    if (this.isOnline && this.syncCallback) {
      try {
        console.log(`🔄 Attempting immediate sync for: ${type}`);
        const success = await this.syncCallback(queueItem);

        if (success) {
          console.log(`✅ Violation submitted immediately: ${type}`);
          // Clean up localStorage frame since it's synced
          this.deleteBlobFromStorage(violationId);
          return {
            success: true,
            message: 'Violation submitted successfully',
            queued: false,
          };
        } else {
          // Submit failed, add to queue
          console.warn(`⚠️ Submit failed, queueing violation: ${type}`);
          // Clear video from memory (too large to keep), keep frame reference
          queueItem.videoProof = undefined;
          this.queue.push(queueItem);
          this.saveQueueToStorage();
          this.notifyListeners();
          
          return {
            success: true,
            message: 'Violation queued for sync',
            queued: true,
          };
        }
      } catch (error: any) {
        console.error(`❌ Error submitting violation ${type}:`, error);
        
        // Add to queue on error (without video, keep frame)
        queueItem.videoProof = undefined;
        this.queue.push(queueItem);
        this.saveQueueToStorage();
        this.notifyListeners();
        
        return {
          success: true,
          message: 'Violation queued due to error',
          queued: true,
        };
      }
    } else {
      // Offline or no callback - add to queue immediately (without video)
      console.log(`🔴 ${this.isOnline ? 'No sync callback' : 'Offline'} - queueing violation: ${type}`);
      queueItem.videoProof = undefined; // Don't keep large video in memory
      this.queue.push(queueItem);
      this.saveQueueToStorage();
      this.notifyListeners();
      
      return {
        success: true,
        message: 'Violation saved offline (will sync when online)',
        queued: true,
      };
    }
  }

  // ==================== SYNC OPERATIONS ====================

  /**
   * Sync all queued violations to Firebase
   */
  public async syncQueue(): Promise<void> {
    if (!this.isOnline) {
      console.log('🔴 Cannot sync violations - offline');
      return;
    }

    if (!this.syncCallback) {
      console.log('⚠️ Cannot sync violations - no callback registered');
      return;
    }

    if (this.syncInProgress) {
      console.log('🔄 Violation sync already in progress');
      return;
    }

    if (this.queue.length === 0) {
      return;
    }

    console.log(`🔄 Starting sync of ${this.queue.length} queued violations...`);
    this.syncInProgress = true;
    this.notifyListeners();

    const pendingItems = this.queue.filter(
      item => item.status === 'pending' && item.retryCount < this.MAX_RETRY_COUNT
    );

    let successCount = 0;
    let failCount = 0;

    for (const item of pendingItems) {
      item.status = 'syncing';
      item.lastSyncAttempt = Date.now();
      this.notifyListeners();

      // Load frame from storage if not in memory (for offline-queued items)
      if (!item.frameProof && !item.videoProof && item.id) {
        item.frameProof = await this.loadBlobFromStorage(item.id) || undefined;
        if (item.frameProof) {
          console.log(`📦 Loaded frame from localStorage for ${item.type}`);
        }
      }

      try {
        const success = await this.syncCallback(item);

        if (success) {
          item.status = 'synced';
          successCount++;
          console.log(`✅ Synced violation: ${item.type}`);
          
          // Clean up localStorage
          if (item.id) {
            this.deleteBlobFromStorage(item.id);
          }
        } else {
          item.status = 'failed';
          item.retryCount++;
          failCount++;
          console.error(`❌ Failed to sync violation: ${item.type} (Retry ${item.retryCount}/${this.MAX_RETRY_COUNT})`);
        }
      } catch (error: any) {
        item.status = 'failed';
        item.retryCount++;
        failCount++;
        console.error(`❌ Error syncing violation ${item.type}:`, error);
      }
    }

    // Remove successfully synced items
    this.queue = this.queue.filter(item => item.status !== 'synced');
    
    // Mark items that exceeded retry count as permanently failed
    this.queue.forEach(item => {
      if (item.retryCount >= this.MAX_RETRY_COUNT) {
        item.status = 'failed';
        console.error(`❌ Violation permanently failed after ${this.MAX_RETRY_COUNT} retries: ${item.type}`);
      }
    });

    this.saveQueueToStorage();
    this.syncInProgress = false;
    this.notifyListeners();

    console.log(`✅ Violation sync complete: ${successCount} succeeded, ${failCount} failed, ${this.queue.length} remaining`);
  }

  /**
   * Retry failed items
   */
  public async retryFailed(): Promise<void> {
    const failedItems = this.queue.filter(item => item.status === 'failed');
    
    if (failedItems.length === 0) {
      console.log('✅ No failed violations to retry');
      return;
    }

    console.log(`🔄 Retrying ${failedItems.length} failed violations...`);
    
    // Reset retry count for failed items
    failedItems.forEach(item => {
      item.status = 'pending';
      item.retryCount = 0;
    });

    await this.syncQueue();
  }

  // ==================== STATUS & LISTENERS ====================

  /**
   * Get current sync status
   */
  public getStatus(): ViolationSyncStatus {
    return {
      isOnline: this.isOnline,
      isSyncing: this.syncInProgress,
      queueLength: this.queue.length,
      lastSyncTime: this.queue.length === 0 ? Date.now() : null,
      failedCount: this.queue.filter(item => item.status === 'failed').length,
    };
  }

  /**
   * Get queue items
   */
  public getQueue(): QueuedViolation[] {
    return [...this.queue];
  }

  /**
   * Subscribe to status changes
   */
  public subscribe(listener: (status: ViolationSyncStatus) => void): () => void {
    this.listeners.push(listener);
    
    // Immediately notify with current status
    listener(this.getStatus());
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notify all listeners of status change
   */
  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach(listener => listener(status));
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Clear all queued violations (use with caution!)
   */
  public clearQueue(): void {
    // Clean up all blob storage
    this.queue.forEach(item => {
      if (item.id) {
        this.deleteBlobFromStorage(item.id);
      }
    });
    
    this.queue = [];
    this.saveQueueToStorage();
    this.notifyListeners();
    console.log('🗑️ Violation queue cleared');
  }

  /**
   * Get pending count for specific attempt
   */
  public getPendingCountForAttempt(attemptId: string): number {
    return this.queue.filter(
      item => item.attemptId === attemptId && item.status !== 'synced'
    ).length;
  }

  /**
   * Force immediate sync
   */
  public async forceSyncNow(): Promise<boolean> {
    if (!this.isOnline) {
      console.log('🔴 Cannot force sync violations - offline');
      return false;
    }

    console.log('⚡ Force syncing all pending violations...');
    await this.syncQueue();
    
    const hasFailures = this.queue.length > 0;
    
    if (hasFailures) {
      console.warn(`⚠️ ${this.queue.length} violations still pending after force sync`);
    } else {
      console.log('✅ All violations synced successfully');
    }
    
    return !hasFailures;
  }
}

// Export singleton instance
export const violationQueueService = ViolationQueueService.getInstance();

// Export types
export type { QueuedViolation, ViolationSyncStatus };