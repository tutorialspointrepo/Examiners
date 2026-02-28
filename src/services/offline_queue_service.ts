// ==================== OFFLINE QUEUE SERVICE ====================
// Handles answer queuing when offline and syncs when online

import { firebaseService } from './firebase_service';

interface QueuedAnswer {
  id: string;
  attemptId: string;
  questionId: string;  // 🔥 Primary key — unique question ID
  questionNo: number;
  answer: string | string[];
  question: any;
  questionBankItem?: any;
  timeSpent?: number;
  markedForReview: boolean;
  imageUrl?: string;
  violations?: any[];
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
}

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  queueLength: number;
  lastSyncTime: number | null;
  failedCount: number;
}

class OfflineQueueService {
  private static instance: OfflineQueueService | null = null;
  private queue: QueuedAnswer[] = [];
  private syncInProgress: boolean = false;
  private isOnline: boolean = navigator.onLine;
  private listeners: Array<(status: SyncStatus) => void> = [];
  
  private readonly STORAGE_KEY = 'exam_answer_queue';
  private readonly MAX_RETRY_COUNT = 3;
  private readonly SYNC_INTERVAL = 5000; // 5 seconds
  private syncTimer: ReturnType<typeof setInterval> | null = null;

  // Singleton pattern
  static getInstance(): OfflineQueueService {
    if (!OfflineQueueService.instance) {
      OfflineQueueService.instance = new OfflineQueueService();
    }
    return OfflineQueueService.instance;
  }

  private constructor() {
    this.loadQueueFromStorage();
    this.setupNetworkListeners();
    this.startAutoSync();
  }

  // ==================== INITIALIZATION ====================

  /**
   * Load queued answers from localStorage
   */
  private loadQueueFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsedQueue = JSON.parse(stored);
        
        // Filter out stale items (older than 24 hours)
        const now = Date.now();
        const freshQueue = parsedQueue.filter((item: QueuedAnswer) => {
          const age = now - item.timestamp;
          const isStale = age > 24 * 60 * 60 * 1000; // 24 hours
          if (isStale) {
            console.log(`🧹 Removing stale queue item (${Math.round(age / 1000 / 60)} minutes old):`, item.questionNo);
          }
          return !isStale;
        });
        
        this.queue = freshQueue;
        console.log(`📦 Loaded ${this.queue.length} queued answers from storage (removed ${parsedQueue.length - freshQueue.length} stale items)`);
        
        // Save cleaned queue back to storage
        if (freshQueue.length !== parsedQueue.length) {
          this.saveQueueToStorage();
        }
      }
    } catch (error) {
      console.error('❌ Error loading queue from storage:', error);
      this.queue = [];
    }
  }

  /**
   * Save queue to localStorage
   */
  private saveQueueToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('❌ Error saving queue to storage:', error);
    }
  }

  /**
   * Setup network event listeners
   */
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      console.log('🌐 Network connection restored');
      this.isOnline = true;
      this.notifyListeners();
      // Immediately sync when connection is restored
      setTimeout(() => this.syncQueue(), 500);
    });

    window.addEventListener('offline', () => {
      console.log('🔴 Network connection lost');
      this.isOnline = false;
      this.notifyListeners();
    });

    // Initial sync if online and has queued items
    if (this.isOnline && this.queue.length > 0) {
      setTimeout(() => this.syncQueue(), 1000);
    }
  }

  /**
   * Start automatic sync timer
   */
  private startAutoSync(): void {
    this.syncTimer = setInterval(() => {
      if (this.isOnline && this.queue.length > 0 && !this.syncInProgress) {
        this.syncQueue();
      }
    }, this.SYNC_INTERVAL);
  }

  /**
   * Stop automatic sync
   */
  public stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  // ==================== QUEUE MANAGEMENT ====================

  /**
   * Add answer to queue (immediate or when offline)
   */
  public async queueAnswer(
    attemptId: string,
    questionId: string,
    questionNo: number,
    answer: string | string[],
    question: any,
    questionBankItem?: any,
    timeSpent?: number,
    markedForReview: boolean = false,
    imageUrl?: string,
    violations?: any[]
  ): Promise<{ success: boolean; message: string; queued: boolean }> {
    
    // ALWAYS save to local backup first using questionId (for instant recovery)
    this.saveAnswerToLocalBackup(attemptId, questionId, answer);
    
    const queueItem: QueuedAnswer = {
      id: `${attemptId}_${questionId}_${Date.now()}`,
      attemptId,
      questionId,
      questionNo,
      answer,
      question,
      questionBankItem,
      timeSpent,
      markedForReview,
      imageUrl,
      violations,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
    };

    // If online, try to submit immediately
    if (this.isOnline) {
      try {
        const result = await firebaseService.submitAnswer(
          attemptId,
          questionId,
          questionNo,
          answer,
          question,
          questionBankItem,
          timeSpent,
          markedForReview,
          imageUrl,
          violations
        );

        if (result.success) {
          console.log(`✅ Answer submitted immediately for Q${questionNo} (ID: ${questionId})`);
          this.clearAnswerFromBackup(attemptId, questionId);
          return {
            success: true,
            message: 'Answer submitted successfully',
            queued: false,
          };
        } else {
          console.warn(`⚠️ Submit failed, queueing answer for Q${questionNo} (ID: ${questionId})`);
          this.queue.push(queueItem);
          this.saveQueueToStorage();
          this.notifyListeners();
          
          return {
            success: true,
            message: 'Answer queued for sync',
            queued: true,
          };
        }
      } catch (error: any) {
        console.error(`❌ Error submitting answer for Q${questionNo} (ID: ${questionId}):`, error);
        
        this.queue.push(queueItem);
        this.saveQueueToStorage();
        this.notifyListeners();
        
        return {
          success: true,
          message: 'Answer queued due to error',
          queued: true,
        };
      }
    } else {
      console.log(`🔴 Offline - queueing answer for Q${questionNo} (ID: ${questionId})`);
      this.queue.push(queueItem);
      this.saveQueueToStorage();
      this.notifyListeners();
      
      return {
        success: true,
        message: 'Answer saved offline (will sync when online)',
        queued: true,
      };
    }
  }

  /**
   * Save answer to local backup (separate from queue)
   * This is for immediate recovery when page refreshes
   */
  private saveAnswerToLocalBackup(
    attemptId: string,
    questionId: string,
    answer: string | string[]
  ): void {
    try {
      const backupKey = `exam_backup_${attemptId}`;
      const backup = JSON.parse(localStorage.getItem(backupKey) || '{}');
      backup[questionId] = {
        answer,
        timestamp: Date.now(),
      };
      localStorage.setItem(backupKey, JSON.stringify(backup));
      console.log(`💾 Saved backup for questionId: ${questionId}`);
    } catch (error) {
      console.error('❌ Error saving to local backup:', error);
    }
  }

  /**
   * Load answers from local backup
   */
  public loadAnswersFromBackup(attemptId: string): Record<string, any> {
    try {
      const backupKey = `exam_backup_${attemptId}`;
      const backup = localStorage.getItem(backupKey);
      if (backup) {
        const parsed = JSON.parse(backup);
        console.log(`📦 Loaded ${Object.keys(parsed).length} backup answers for attempt ${attemptId}`);
        return parsed;
      }
      return {};
    } catch (error) {
      console.error('❌ Error loading from backup:', error);
      return {};
    }
  }

  /**
   * Clear specific answer from backup (after successful sync)
   */
  private clearAnswerFromBackup(attemptId: string, questionId: string): void {
    try {
      const backupKey = `exam_backup_${attemptId}`;
      const backup = JSON.parse(localStorage.getItem(backupKey) || '{}');
      
      if (backup[questionId]) {
        delete backup[questionId];
        
        if (Object.keys(backup).length === 0) {
          localStorage.removeItem(backupKey);
          console.log(`🗑️ Backup empty - removed for attempt ${attemptId}`);
        } else {
          localStorage.setItem(backupKey, JSON.stringify(backup));
          console.log(`🧹 Cleared ${questionId} from backup (${Object.keys(backup).length} remaining)`);
        }
      }
    } catch (error) {
      console.error('❌ Error clearing answer from backup:', error);
    }
  }

  /**
   * Clear entire backup after successful submission
   */
  public clearBackup(attemptId: string): void {
    try {
      const backupKey = `exam_backup_${attemptId}`;
      localStorage.removeItem(backupKey);
      console.log(`🗑️ Cleared entire backup for attempt ${attemptId}`);
    } catch (error) {
      console.error('❌ Error clearing backup:', error);
    }
  }

  // ==================== SYNC OPERATIONS ====================

  /**
   * Sync all queued answers to Firebase
   */
  public async syncQueue(): Promise<void> {
    if (!this.isOnline) {
      console.log('🔴 Cannot sync - offline');
      return;
    }

    if (this.syncInProgress) {
      console.log('🔄 Sync already in progress');
      return;
    }

    if (this.queue.length === 0) {
      return;
    }

    console.log(`🔄 Starting sync of ${this.queue.length} queued answers...`);
    this.syncInProgress = true;
    this.notifyListeners();

    const pendingItems = this.queue.filter(
      item => item.status === 'pending' && item.retryCount < this.MAX_RETRY_COUNT
    );

    let successCount = 0;
    let failCount = 0;

    for (const item of pendingItems) {
      item.status = 'syncing';
      this.notifyListeners();

      try {
        const result = await firebaseService.submitAnswer(
          item.attemptId,
          item.questionId,
          item.questionNo,
          item.answer,
          item.question,
          item.questionBankItem,
          item.timeSpent,
          item.markedForReview,
          item.imageUrl,
          item.violations
        );

        if (result.success) {
          item.status = 'synced';
          successCount++;
          console.log(`✅ Synced answer for Q${item.questionNo} (ID: ${item.questionId})`);
          
          this.clearAnswerFromBackup(item.attemptId, item.questionId);
        } else {
          item.status = 'failed';
          item.retryCount++;
          failCount++;
          console.error(`❌ Failed to sync answer for Q${item.questionNo} (ID: ${item.questionId}):`, result.message);
        }
      } catch (error: any) {
        item.status = 'failed';
        item.retryCount++;
        failCount++;
        console.error(`❌ Error syncing answer for Q${item.questionNo} (ID: ${item.questionId}):`, error);
      }
    }

    // Remove successfully synced items
    this.queue = this.queue.filter(item => item.status !== 'synced');
    
    // ✅ AUTO-CLEAR: If queue is now empty, clear entire backup
    if (this.queue.length === 0 && successCount > 0) {
      // Get all unique attemptIds from synced items
      const syncedAttemptIds = new Set(pendingItems.filter(i => i.status === 'synced').map(i => i.attemptId));
      syncedAttemptIds.forEach(attemptId => {
        this.clearBackup(attemptId);
        console.log(`🧹 All answers synced - cleared entire backup for attempt ${attemptId}`);
      });
    }
    
    // Mark items that exceeded retry count as permanently failed
    this.queue.forEach(item => {
      if (item.retryCount >= this.MAX_RETRY_COUNT) {
        item.status = 'failed';
      }
    });

    this.saveQueueToStorage();
    this.syncInProgress = false;
    this.notifyListeners();

    console.log(`✅ Sync complete: ${successCount} succeeded, ${failCount} failed, ${this.queue.length} remaining`);
  }

  /**
   * Retry failed items
   */
  public async retryFailed(): Promise<void> {
    const failedItems = this.queue.filter(item => item.status === 'failed');
    
    if (failedItems.length === 0) {
      console.log('✅ No failed items to retry');
      return;
    }

    console.log(`🔄 Retrying ${failedItems.length} failed items...`);
    
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
  public getStatus(): SyncStatus {
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
  public getQueue(): QueuedAnswer[] {
    return [...this.queue];
  }

  /**
   * Subscribe to status changes
   */
  public subscribe(listener: (status: SyncStatus) => void): () => void {
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
   * Clear all queued answers (use with caution!)
   */
  public clearQueue(): void {
    this.queue = [];
    this.saveQueueToStorage();
    this.notifyListeners();
    console.log('🗑️ Queue cleared');
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
   * Force immediate sync (call when user clicks submit exam)
   * Returns true if all items synced successfully
   */
  public async forceSyncNow(): Promise<boolean> {
    if (!this.isOnline) {
      console.log('🔴 Cannot force sync - offline');
      return false;
    }

    console.log('⚡ Force syncing all pending answers...');
    await this.syncQueue();
    
    // Check if queue is empty (all synced)
    const hasFailures = this.queue.length > 0;
    
    if (hasFailures) {
      console.warn(`⚠️ ${this.queue.length} answers still pending after force sync`);
    } else {
      console.log('✅ All answers synced successfully');
    }
    
    return !hasFailures;
  }
}

// Export singleton instance
export const offlineQueueService = OfflineQueueService.getInstance();

// Export types
export type { QueuedAnswer, SyncStatus };