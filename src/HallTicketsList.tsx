import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faIdCard,
  faCalendar,
  faChair,
  faChevronLeft,
  faChevronRight,
  faDownload,
  faPrint,
  faClipboardList,
  faMapMarkerAlt
} from '@fortawesome/free-solid-svg-icons';

interface HallTicketListProps {
  activeCollegeId: string | null;
  selectedHallTicketGroup: any;
  brandTheme: any;
  onClose?: () => void;
  currentUser?: any;
  isSecureBrowser?: boolean;
}

interface HallTicket {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  email: string;
  phone?: string;
  class: string;
  board: string;
  examName: string;
  examType: string;
  examDate: string;
  examTime: string;
  duration: string;
  venue: string;
  seatNumber?: string;
  hallTicketNumber: string;
  validityFrom: string;
  validityTo: string;
  instructions?: string[];
  photo?: string;
  hallTicketStatus?: string;
  hallTicketSent?: boolean;
}

const HallTicketsList: React.FC<HallTicketListProps> = ({
  activeCollegeId,
  selectedHallTicketGroup,
  brandTheme,
  currentUser,
  isSecureBrowser = false,
}) => {
  const [hallTickets, setHallTickets] = useState<HallTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalHallTickets, setTotalHallTickets] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const ticketsPerPage = 10;

  useEffect(() => {
    console.log('📋 HallTicketList mounted/updated with props:', {
      hasCollegeId: !!activeCollegeId,
      hasSelectedGroup: !!selectedHallTicketGroup,
      selectedGroupId: selectedHallTicketGroup?.id,
      selectedGroupExamId: selectedHallTicketGroup?.examId,
      hasBrandTheme: !!brandTheme,
      brandThemeGradient: brandTheme?.gradients?.primary || 'not available'
    });
    
    if (selectedHallTicketGroup) {
      setCurrentPage(1);
      loadHallTickets(1);
    }
  }, [selectedHallTicketGroup]);

  const loadHallTickets = async (page: number) => {
    if (!activeCollegeId || !selectedHallTicketGroup) return;

    setLoading(true);
    try {
      console.log('📋 Loading hall tickets from selected group:', {
        groupId: selectedHallTicketGroup.id,
        hasStudents: !!selectedHallTicketGroup.students,
        studentsCount: selectedHallTicketGroup.students?.length || 0,
        hasRooms: !!selectedHallTicketGroup.rooms,
        roomsCount: selectedHallTicketGroup.rooms?.length || 0,
        page,
        ticketsPerPage
      });

      // Get students from the selected hall ticket group
      const allStudents = selectedHallTicketGroup.students || [];
      
      if (allStudents.length === 0) {
        console.warn('⚠️ No students found in hall ticket group');
        setHallTickets([]);
        setTotalHallTickets(0);
        setHasMore(false);
        setCurrentPage(1);
        setLoading(false);
        return;
      }
      
      // Filter students if current user is a student - show only their hall ticket
      let studentsToShow = allStudents;
      if (currentUser?.userType === 'student' && currentUser?.userId) {
        console.log('👨‍🎓 Filtering hall tickets for student:', currentUser.userId);
        studentsToShow = allStudents.filter((student: any) => 
          student.studentId === currentUser.userId
        );
        console.log(`🎯 Showing ${studentsToShow.length} hall ticket(s) for student`);
        
        if (studentsToShow.length === 0) {
          console.warn('⚠️ Student not found in this hall ticket group');
          setHallTickets([]);
          setTotalHallTickets(0);
          setHasMore(false);
          setCurrentPage(1);
          setLoading(false);
          return;
        }
      }
      
      // Log first student for debugging
      console.log('👤 First student data:', {
        studentId: studentsToShow[0].studentId,
        hasRoomName: !!studentsToShow[0].roomName,
        hasRoomAddress: !!studentsToShow[0].roomAddress,
        hasRoomId: !!studentsToShow[0].roomId,
        roomId: studentsToShow[0].roomId
      });

      // Map students to hall ticket format
      const allTickets: HallTicket[] = studentsToShow.map((student: any, index: number) => {
        // Format venue as "Room Name, Room Address"
        let venue = 'To be announced';
        
        if (student.roomName || student.roomAddress) {
          // Student has room info stored directly
          const parts = [];
          if (student.roomName) parts.push(student.roomName);
          if (student.roomAddress) parts.push(student.roomAddress);
          venue = parts.join(', ');
          if (index === 0) console.log('✅ Using direct room info from student:', venue);
        } else if (student.roomId && selectedHallTicketGroup.rooms) {
          // Student has roomId but no address - look it up from rooms array
          if (index === 0) console.log('🔍 Looking up room from rooms array. roomId:', student.roomId, 'Available rooms:', selectedHallTicketGroup.rooms.length);
          const room = selectedHallTicketGroup.rooms.find((r: any) => r.room_id === student.roomId);
          if (room) {
            if (index === 0) console.log('✅ Found room:', room);
            const parts = [];
            if (room.room_name) parts.push(room.room_name);
            if (room.room_address) parts.push(room.room_address);
            venue = parts.length > 0 ? parts.join(', ') : 'To be announced';
            if (index === 0) console.log('✅ Formatted venue:', venue);
          } else {
            if (index === 0) console.log('❌ Room not found in rooms array');
          }
        } else if (selectedHallTicketGroup.venue) {
          // Fallback to group venue
          venue = selectedHallTicketGroup.venue;
          if (index === 0) console.log('⚠️ Using group fallback venue:', venue);
        }
        
        return {
          id: student.hallTicketNumber || `ht-${student.studentId}`,
          studentId: student.studentId,
          studentName: student.studentName,
          rollNumber: student.rollNumber,
          email: student.email || '',
          phone: student.phone || undefined,
          class: selectedHallTicketGroup.class,
          board: selectedHallTicketGroup.board || '',
          examName: selectedHallTicketGroup.examName,
          examType: selectedHallTicketGroup.examType,
          examDate: selectedHallTicketGroup.examDate,
          examTime: selectedHallTicketGroup.examTime || '',
          duration: selectedHallTicketGroup.duration || '',
          venue: venue,
          seatNumber: student.seatNumber || `S-${String(index + 1).padStart(3, '0')}`,
          hallTicketNumber: student.hallTicketNumber,
          validityFrom: selectedHallTicketGroup.validityFrom,
          validityTo: selectedHallTicketGroup.validityTo,
          hallTicketStatus: student.hallTicketStatus || 'active',
          hallTicketSent: student.hallTicketSent || false,
          instructions: selectedHallTicketGroup.instructions || [
            'Bring your own stationery',
            'Report 30 minutes before exam',
            'Carry valid ID proof'
          ],
          photo: student.photo || undefined
        };
      });

      const total = allTickets.length;

      // Implement pagination
      const startIndex = (page - 1) * ticketsPerPage;
      const endIndex = startIndex + ticketsPerPage;
      const paginatedTickets = allTickets.slice(startIndex, endIndex);
      const hasMoreTickets = endIndex < total;

      setHallTickets(paginatedTickets);
      setTotalHallTickets(total);
      setHasMore(hasMoreTickets);
      setCurrentPage(page);

      console.log('✅ Hall tickets loaded from Firebase data:', {
        count: paginatedTickets.length,
        total,
        hasMore: hasMoreTickets,
        page
      });

    } catch (error) {
      console.error('❌ Error loading hall tickets:', error);
      setHallTickets([]);
      setTotalHallTickets(0);
    } finally {
      setLoading(false);
    }
  };

  const handleNextPage = () => {
    if (hasMore && !loading) {
      loadHallTickets(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1 && !loading) {
      loadHallTickets(currentPage - 1);
    }
  };

  const handlePrintHallTicket = (hallTicket: HallTicket) => {
    console.log('🖨️ Print hall ticket:', hallTicket.id);
    
    // Find the hall ticket card element
    const printCard = document.querySelector(`[data-ticket-id="${hallTicket.id}"]`);
    
    if (printCard) {
      console.log('✅ Found card to print:', hallTicket.id);
      
      // Clone the card
      const clone = printCard.cloneNode(true) as HTMLElement;
      
      // Remove buttons from clone
      const buttons = clone.querySelectorAll('button');
      buttons.forEach(btn => btn.remove());
      
      // Get all stylesheets from the current page
      const styles = Array.from(document.styleSheets)
        .map(styleSheet => {
          try {
            return Array.from(styleSheet.cssRules)
              .map(rule => rule.cssText)
              .join('\n');
          } catch (e) {
            console.warn('Could not access stylesheet:', e);
            return '';
          }
        })
        .join('\n');
      
      // Create a new window for printing
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Hall Ticket - ${hallTicket.studentName}</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              ${styles}
              
              body {
                margin: 0;
                padding: 20px;
                background: white;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              }
              
              @page {
                margin: 1cm;
                size: A4 portrait;
              }
              
              @media print {
                body {
                  padding: 0;
                }
              }
            </style>
          </head>
          <body>
            ${clone.outerHTML}
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  setTimeout(function() {
                    window.close();
                  }, 100);
                }, 500);
              };
            </script>
          </body>
          </html>
        `);
        printWindow.document.close();
      } else {
        console.error('❌ Could not open print window');
        alert('Please allow popups to print hall tickets');
      }
    } else {
      console.error('❌ Could not find hall ticket card for printing');
    }
  };

  const handleDownloadHallTicket = async (hallTicket: HallTicket) => {
    console.log('💾 Download hall ticket:', hallTicket.id);
    
    // Prevent multiple simultaneous downloads
    if (downloading) {
      console.log('⏳ Another download is in progress...');
      return;
    }
    
    setDownloading(hallTicket.id);
    
    // Find the hall ticket card element
    const printCard = document.querySelector(`[data-ticket-id="${hallTicket.id}"]`);
    
    if (!printCard) {
      console.error('❌ Could not find hall ticket card for download');
      alert('Unable to find hall ticket. Please try again.');
      setDownloading(null);
      return;
    }
    
    try {
      console.log('📄 Preparing PDF...');
      
      // Clone the card
      const clone = printCard.cloneNode(true) as HTMLElement;
      
      // Remove buttons from clone
      const buttons = clone.querySelectorAll('button');
      buttons.forEach(btn => btn.remove());
      
      // Replace FontAwesome icons with Unicode symbols
      const iconReplacements: { [key: string]: string } = {
        'fa-id-card': '🆔',
        'fa-calendar': '📅',
        'fa-map-marker-alt': '📍',
        'fa-chair': '🪑',
        'fa-clipboard-list': '📋'
      };
      
      // Find all FontAwesome icons and replace with Unicode
      const icons = clone.querySelectorAll('svg[data-icon]');
      icons.forEach(icon => {
        const iconName = icon.getAttribute('data-icon');
        const parent = icon.parentElement;
        if (parent && iconName) {
          const unicodeSymbol = iconReplacements[`fa-${iconName}`] || '•';
          const span = document.createElement('span');
          span.textContent = unicodeSymbol;
          span.style.fontSize = '20px';
          span.style.marginRight = '8px';
          parent.replaceChild(span, icon);
        }
      });
      
      // Get all stylesheets from the current page
      const styles = Array.from(document.styleSheets)
        .map(styleSheet => {
          try {
            return Array.from(styleSheet.cssRules)
              .map(rule => rule.cssText)
              .join('\n');
          } catch (e) {
            console.warn('Could not access stylesheet:', e);
            return '';
          }
        })
        .join('\n');
      
      // Load html2pdf library if not already loaded
      if (!(window as any).html2pdf) {
        console.log('📦 Loading html2pdf library...');
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        document.head.appendChild(script);
        
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          setTimeout(reject, 10000); // 10 second timeout
        });
        
        console.log('✅ html2pdf library loaded');
      }
      
      // Create temporary iframe for rendering
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.width = '800px';
      iframe.style.height = '1200px';
      document.body.appendChild(iframe);
      
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>${styles}</style>
            <style>
              body {
                margin: 0;
                padding: 20px;
                background: white;
                width: 800px;
              }
            </style>
          </head>
          <body>
            ${clone.outerHTML}
          </body>
          </html>
        `);
        iframeDoc.close();
        
        // Wait for iframe to fully render
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('🔄 Converting to PDF...');
        
        // PDF options
        const opt = {
          margin: 10,
          filename: `HallTicket_${hallTicket.rollNumber}_${hallTicket.studentName.replace(/\s+/g, '_')}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { 
            scale: 2,
            useCORS: true,
            letterRendering: true,
            backgroundColor: '#ffffff'
          },
          jsPDF: { 
            unit: 'mm', 
            format: 'a4', 
            orientation: 'portrait' 
          }
        };
        
        // Generate PDF from iframe content
        await (window as any).html2pdf().set(opt).from(iframeDoc.body).save();
        
        console.log('✅ PDF downloaded successfully!');
        
        // Clean up
        document.body.removeChild(iframe);
      }
      
    } catch (error) {
      console.error('❌ Error generating PDF:', error);
      alert('Failed to generate PDF. Please try the Print button instead.');
    } finally {
      setDownloading(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };
  
  const formatGeneratedDate = (timestamp: any) => {
    try {
      // Handle Firebase Timestamp object
      if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
        const date = new Date(timestamp.seconds * 1000);
        return date.toLocaleDateString('en-US', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
      }
      
      // Handle ISO string
      if (typeof timestamp === 'string') {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('en-US', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
        }
      }
      
      // Fallback to current date
      return new Date().toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch (error) {
      console.error('Error formatting generated date:', error);
      return 'Invalid Date';
    }
  };

  const totalPages = Math.ceil(totalHallTickets / ticketsPerPage);

  if (!selectedHallTicketGroup) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-8">
        <div className="text-center max-w-md">
          {/* Floating decorative circles */}
          <div className="relative mb-12">
            {/* Main center circle */}
            <div className="relative inline-block">
              <div 
                className="w-40 h-40 rounded-full flex items-center justify-center shadow-2xl animate-pulse"
                style={{ 
                  background: 'linear-gradient(135deg, #FFA500 0%, #FF8C00 100%)',
                  animationDuration: '3s'
                }}
              >
                <FontAwesomeIcon icon={faIdCard} className="text-white text-6xl" />
              </div>
              
              {/* Floating circles around main circle */}
              {/* Top right - Pink/Red circle */}
              <div 
                className="absolute -top-4 -right-8 w-16 h-16 rounded-full flex items-center justify-center shadow-lg animate-bounce"
                style={{ 
                  background: 'linear-gradient(135deg, #FF6B9D 0%, #FF1744 100%)',
                  animationDuration: '2s',
                  animationDelay: '0s'
                }}
              >
                <FontAwesomeIcon icon={faClipboardList} className="text-white text-2xl" />
              </div>
              
              {/* Bottom left - Purple circle */}
              <div 
                className="absolute -bottom-6 -left-8 w-20 h-20 rounded-full flex items-center justify-center shadow-lg animate-bounce"
                style={{ 
                  background: 'linear-gradient(135deg, #9C27B0 0%, #7B1FA2 100%)',
                  animationDuration: '2.5s',
                  animationDelay: '0.3s'
                }}
              >
                <FontAwesomeIcon icon={faCalendar} className="text-white text-2xl" />
              </div>
              
              {/* Top right far - Teal/Green circle */}
              <div 
                className="absolute top-8 -right-20 w-14 h-14 rounded-full flex items-center justify-center shadow-lg animate-bounce"
                style={{ 
                  background: 'linear-gradient(135deg, #00BCD4 0%, #0097A7 100%)',
                  animationDuration: '2.2s',
                  animationDelay: '0.6s'
                }}
              >
                <FontAwesomeIcon icon={faDownload} className="text-white text-xl" />
              </div>
              
              {/* Bottom right - Orange circle */}
              <div 
                className="absolute -bottom-2 right-12 w-12 h-12 rounded-full flex items-center justify-center shadow-lg animate-bounce"
                style={{ 
                  background: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
                  animationDuration: '2.8s',
                  animationDelay: '0.9s'
                }}
              >
                <FontAwesomeIcon icon={faPrint} className="text-white text-lg" />
              </div>
            </div>
          </div>

          {/* Text content */}
          <h3 className="text-2xl font-bold text-gray-900 mb-3">
            No Hall Ticket Group Selected
          </h3>
          <p className="text-gray-600 leading-relaxed mb-8">
            Select a hall ticket group from the list to view hall tickets, manage students, and perform actions.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="flex items-center space-x-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-medium">
              <FontAwesomeIcon icon={faIdCard} />
              <span>MCQ</span>
            </div>
            <div className="flex items-center space-x-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-full text-sm font-medium">
              <FontAwesomeIcon icon={faClipboardList} />
              <span>Descriptive</span>
            </div>
            <div className="flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
              <FontAwesomeIcon icon={faDownload} />
              <span>All Types</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Hall Tickets</h3>
            <p className="text-sm text-gray-600">
              {selectedHallTicketGroup.class} - {selectedHallTicketGroup.examType}
            </p>
          </div>
          <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full font-medium">
            {totalHallTickets} ticket{totalHallTickets !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Hall Tickets List */}
      <div className="flex-1 overflow-y-auto px-6 py-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading hall tickets...</p>
            </div>
          </div>
        ) : hallTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            {/* Animated Illustration */}
            <div className="mb-8 relative">
              {/* Background decoration */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-40 h-40 bg-gradient-to-br from-orange-200 to-red-200 rounded-full opacity-20 blur-2xl"></div>
              </div>
              
              {/* Main empty icon container */}
              <div className="relative">
                {/* Empty ticket illustration */}
                <div className="inline-flex items-center justify-center w-28 h-28 rounded-2xl shadow-xl mb-4 relative overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 border border-dashed border-gray-300">
                  <FontAwesomeIcon icon={faIdCard} className="text-gray-400 text-4xl" />
                </div>
                
                {/* Floating info icon */}
                <div className="absolute -top-3 -right-3 w-12 h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-white text-xl font-bold">!</span>
                </div>
              </div>
            </div>

            {/* Text content */}
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              No Hall Tickets Generated
            </h3>
            <p className="text-gray-600 max-w-sm mb-6">
              Hall tickets haven't been generated for this exam yet. They will appear here once created.
            </p>

            {/* Info box */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-6 py-4 max-w-md">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                    <FontAwesomeIcon icon={faClipboardList} className="text-white text-sm" />
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-blue-900 mb-1">
                    How to generate hall tickets?
                  </p>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    Go to the exam settings and use the "Generate Hall Tickets" option to create tickets for all enrolled students.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {hallTickets.map((ticket) => (
              <div
                key={ticket.id}
                data-ticket-id={ticket.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Card Content */}
                <div className="p-8">
                  {/* Top Section: Student Name & Actions */}
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h2 className="text-3xl font-bold text-gray-900">{ticket.studentName}</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDownloadHallTicket(ticket)}
                        disabled={downloading === ticket.id}
                        className={`p-2.5 rounded-lg transition-colors ${
                          downloading === ticket.id
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        title={downloading === ticket.id ? 'Generating PDF...' : 'Download as PDF'}
                      >
                        {downloading === ticket.id ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600"></div>
                        ) : (
                          <FontAwesomeIcon icon={faDownload} className="text-lg" />
                        )}
                      </button>
                      {!isSecureBrowser && (
                        <button
                          onClick={() => handlePrintHallTicket(ticket)}
                          className="p-2.5 text-white rounded-lg hover:opacity-90 transition-opacity"
                          style={{ backgroundColor: brandTheme.colors.primary }}
                          title="Print"
                        >
                          <FontAwesomeIcon icon={faPrint} className="text-lg" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Roll Number, Email, Phone Row */}
                  <div className="flex items-center gap-6 mb-8 text-sm flex-wrap">
                    <div className="flex items-center gap-2">
                      <FontAwesomeIcon icon={faIdCard} className="text-blue-500" />
                      <span className="font-semibold text-gray-700">Roll Number:</span>
                      <span className="text-gray-900 font-medium">{ticket.rollNumber}</span>
                    </div>
                    <a href={`mailto:${ticket.email}`} className="flex items-center gap-2 text-blue-600 hover:underline">
                      {ticket.email}
                    </a>
                    {ticket.phone && (
                      <span className="text-gray-600">{ticket.phone}</span>
                    )}
                  </div>

                  {/* Exam Details Section */}
                  <div className="grid grid-cols-2 gap-8 mb-6">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <FontAwesomeIcon icon={faCalendar} className="text-purple-500 text-lg" />
                        <h3 className="text-sm font-semibold text-gray-700">Exam Details</h3>
                      </div>
                      <p className="text-base text-gray-900 font-medium">
                        {ticket.class}, {ticket.examName}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <FontAwesomeIcon icon={faClipboardList} className="text-purple-500 text-lg" />
                        <h3 className="text-sm font-semibold text-gray-700">Exam</h3>
                      </div>
                      <p className="text-base text-gray-600 font-medium">{ticket.examType}</p>
                    </div>
                  </div>

                  {/* Validity Section */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-1">
                      <FontAwesomeIcon icon={faCalendar} className="text-orange-500 text-lg" />
                      <span className="text-sm font-semibold text-gray-700">Validity:</span>
                      <span className="text-sm text-gray-900 font-medium">
                        {formatDate(ticket.validityFrom)} to {formatDate(ticket.validityTo)}
                      </span>
                    </div>
                  </div>

                  {/* Venue Section */}
                  <div className="mb-6">
                    <div className="flex items-start gap-2">
                      <FontAwesomeIcon icon={faMapMarkerAlt} className="text-red-500 text-lg mt-0.5" />
                      <div className="flex-1">
                        <span className="text-sm font-semibold text-gray-700">Venue:</span>
                        <span className="text-sm text-gray-900 font-medium ml-2">{ticket.venue}</span>
                      </div>
                    </div>
                  </div>

                  {/* Seat Number Section */}
                  <div className="mb-8">
                    <div className="flex items-center gap-3">
                      <FontAwesomeIcon icon={faChair} className="text-orange-500 text-lg" />
                      <span className="text-sm font-semibold text-gray-700">Seat Number:</span>
                      <span 
                        className="px-4 py-1.5 rounded-full text-white text-sm font-semibold"
                        style={{ backgroundColor: brandTheme.colors.primary }}
                      >
                        {ticket.seatNumber}
                      </span>
                    </div>
                  </div>

                  {/* Footer Section */}
                  <div className="border-t border-gray-300 pt-6 mt-8">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-600 mb-1">Generated on:</p>
                        <p className="text-sm text-gray-500">{formatGeneratedDate(selectedHallTicketGroup.createdDate || selectedHallTicketGroup.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <div className="border-t-2 border-gray-800 w-48 mb-2"></div>
                        <p className="text-sm font-semibold text-gray-800">Authorized Signature</p>
                        <p className="text-xs text-gray-500">Principal/Exam Controller</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination - Hide for students since they only see their own hall ticket */}
      {!loading && hallTickets.length > 0 && currentUser?.userType !== 'student' && totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {(currentPage - 1) * ticketsPerPage + 1} to{' '}
              {Math.min(currentPage * ticketsPerPage, totalHallTickets)} of {totalHallTickets}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1 || loading}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentPage === 1 || loading
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <FontAwesomeIcon icon={faChevronLeft} className="mr-2" />
                Previous
              </button>
              
              <span className="text-sm text-gray-600 px-3">
                Page {currentPage} of {totalPages}
              </span>
              
              <button
                onClick={handleNextPage}
                disabled={!hasMore || loading}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !hasMore || loading
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Next
                <FontAwesomeIcon icon={faChevronRight} className="ml-2" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HallTicketsList;