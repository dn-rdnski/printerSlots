import { useState, useEffect } from 'react';
import { 
  format, 
  addMinutes, 
  startOfDay, 
  addDays, 
  parseISO, 
  isBefore,
  setHours,
  setMinutes
} from 'date-fns';

type BookingMap = Record<string, string>;

function App() {
  const API_URL = '/api/bookings';

  const [baseDate, setBaseDate] = useState(startOfDay(new Date()));
  const [userName, setUserName] = useState<string>(() => localStorage.getItem('printer_userName') || '');
  const [bookings, setBookings] = useState<BookingMap>({});
  
  // Load bookings from server on mount
  useEffect(() => {
    fetch(API_URL)
      .then(res => res.json())
      .then(data => setBookings(data))
      .catch(err => console.error("Failed to load from server", err));
  }, []);

  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartSlot, setDragStartSlot] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [showNameModal, setShowNameModal] = useState(false);

  const [expandedRanges, setExpandedRanges] = useState<Record<string, string[]>>({});

  // 3 days from baseDate
  const days = [0, 1, 2].map(d => addDays(baseDate, d));
  
  // Full 24 hours
  const startTime = 0;
  const hoursToShow = 24;
  const slotDurationMinutes = 30;
  const slotsPerDay = (hoursToShow * 60) / slotDurationMinutes;

  useEffect(() => {
    localStorage.setItem('printer_userName', userName);
  }, [userName]);

  const toggleRange = (dayStr: string, rangeId: string) => {
    setExpandedRanges(prev => {
      const dayRanges = prev[dayStr] || [];
      const newRanges = dayRanges.includes(rangeId) 
        ? dayRanges.filter(r => r !== rangeId) 
        : [...dayRanges, rangeId];
      return { ...prev, [dayStr]: newRanges };
    });
  };

  const getSlotId = (day: Date, hour: number, minute: number) => {
    const d = setMinutes(setHours(startOfDay(day), hour), minute);
    return format(d, "yyyy-MM-dd'T'HH:mm");
  };

  const allSlots = days.flatMap(day => {
    const daySlots = [];
    for (let i = 0; i < slotsPerDay; i++) {
      const totalMinutes = i * slotDurationMinutes;
      const h = startTime + Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      daySlots.push(getSlotId(day, h, m));
    }
    return daySlots;
  });

  const saveToServer = async (newBookings: BookingMap) => {
    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBookings),
      });
    } catch (err) {
      console.error("Failed to save to server", err);
    }
  };

  const handleMouseDown = (slotId: string) => {
    if (bookings[slotId]) return;
    setIsDragging(true);
    setDragStartSlot(slotId);
    setSelectedSlots([slotId]);
  };

  const handleMouseEnter = (slotId: string) => {
    if (!isDragging || !dragStartSlot) return;
    
    const startIndex = allSlots.indexOf(dragStartSlot);
    const currentIndex = allSlots.indexOf(slotId);
    
    if (startIndex === -1 || currentIndex === -1) return;
    
    const start = Math.min(startIndex, currentIndex);
    const end = Math.max(startIndex, currentIndex);
    
    const range = allSlots.slice(start, end + 1);
    
    // Check if any slot in range is already booked
    const isAnyBooked = range.some(s => bookings[s]);
    if (!isAnyBooked) {
      setSelectedSlots(range);
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      if (selectedSlots.length > 0) {
        if (!userName) {
          setShowNameModal(true);
        }
      }
    }
  };

  const finalizeBooking = () => {
    const finalName = userName || nameInput;
    if (!finalName) return;
    
    const newBookings = { ...bookings };
    selectedSlots.forEach(slot => {
      newBookings[slot] = finalName;
    });
    
    setBookings(newBookings);
    saveToServer(newBookings);
    setUserName(finalName);
    setSelectedSlots([]);
    setShowNameModal(false);
  };

  const clearSelection = () => {
    setSelectedSlots([]);
    setDragStartSlot(null);
  };

  const [manualDate, setManualDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [manualStartTime, setManualStartTime] = useState(format(new Date(), 'HH:00'));
  const [manualEndTime, setManualEndTime] = useState(format(addMinutes(new Date(), 60), 'HH:00'));

  const handleManualBook = () => {
    const start = parseISO(`${manualDate}T${manualStartTime}`);
    const end = parseISO(`${manualDate}T${manualEndTime}`);
    
    if (isBefore(end, start) || end.getTime() === start.getTime()) {
      alert("End time must be after start time");
      return;
    }

    const slotsToBook: string[] = [];
    let current = start;
    while (isBefore(current, end)) {
      slotsToBook.push(format(current, "yyyy-MM-dd'T'HH:mm"));
      current = addMinutes(current, 30);
    }

    // Check if any are already booked
    const alreadyBooked = slotsToBook.filter(s => bookings[s]);
    if (alreadyBooked.length > 0) {
      alert("Some of the selected slots are already booked.");
      return;
    }

    setSelectedSlots(slotsToBook);
    if (!userName) {
      setShowNameModal(true);
    }
  };

  const getRangeColor = (booked: number, total: number) => {
    const availability = (total - booked) / total;
    // HSL: 0 is red, 120 is green
    const hue = availability * 120;
    return `hsl(${hue}, 75%, 45%)`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8" onMouseUp={handleMouseUp}>
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 text-center relative">
          <h1 className="text-4xl font-bold text-indigo-600 mb-2">Printer Slot Booker</h1>
          <p className="text-gray-600">Click and drag to select 30-minute slots</p>
          {userName && (
            <div className="mt-4 inline-flex items-center gap-2 bg-indigo-100 px-4 py-2 rounded-full text-indigo-700 font-medium">
              <span>Hi, {userName}!</span>
              <button 
                onClick={() => setUserName('')}
                className="text-xs underline hover:text-indigo-900"
              >
                (Change)
              </button>
            </div>
          )}
          
          <div className="mt-8 flex items-center justify-between bg-white p-2 rounded-2xl shadow-sm border border-gray-200">
            <button 
              onClick={() => setBaseDate(prev => addDays(prev, -3))}
              className="px-4 py-2 hover:bg-gray-50 rounded-xl font-bold text-indigo-600 transition-colors"
            >
              ← Previous 3 Days
            </button>
            <span className="font-bold text-gray-400 uppercase tracking-widest text-xs">Browsing Schedule</span>
            <button 
              onClick={() => setBaseDate(prev => addDays(prev, 3))}
              className="px-4 py-2 hover:bg-gray-50 rounded-xl font-bold text-indigo-600 transition-colors"
            >
              Next 3 Days →
            </button>
          </div>
        </header>

        <section className="mb-10 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-sm">1</span>
            Quick Select / Date-Time Input
          </h2>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Date</label>
              <input 
                type="date" 
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Start Time</label>
              <input 
                type="time" 
                step="1800"
                value={manualStartTime}
                onChange={(e) => setManualStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">End Time</label>
              <input 
                type="time" 
                step="1800"
                value={manualEndTime}
                onChange={(e) => setManualEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <button 
              onClick={handleManualBook}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold transition-all hover:shadow-lg"
            >
              Select
            </button>
          </div>
        </section>

        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-sm">2</span>
          Click & Drag Grid
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {days.map((day, dayIndex) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const daySlots = allSlots.slice(dayIndex * slotsPerDay, (dayIndex + 1) * slotsPerDay);
            
            const ranges = [
              { id: 'early', label: '00:00 - 08:00', start: 0, end: 16 },
              { id: 'mid', label: '08:00 - 16:00', start: 16, end: 32 },
              { id: 'late', label: '16:00 - 00:00', start: 32, end: 48 },
            ];

            return (
              <div key={dayIndex} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col transition-all">
                <div className="bg-indigo-50 p-4 text-center border-b border-indigo-100">
                  <div className="font-bold text-indigo-900 text-lg">{format(day, 'EEEE')}</div>
                  <div className="text-sm text-indigo-600 font-medium">{format(day, 'MMM d')}</div>
                </div>

                <div className="p-2 space-y-2">
                  {ranges.map(range => {
                    const isExpanded = (expandedRanges[dayStr] || []).includes(range.id);
                    const rangeSlots = daySlots.slice(range.start, range.end);
                    const bookedInRange = rangeSlots.filter(s => bookings[s]).length;
                    const rangeColor = getRangeColor(bookedInRange, 16);

                    return (
                      <div key={range.id} className="border border-gray-100 rounded-xl overflow-hidden">
                        <button
                          onClick={() => toggleRange(dayStr, range.id)}
                          style={{ backgroundColor: isExpanded ? rangeColor : undefined }}
                          className={`w-full p-4 flex flex-col items-center justify-center transition-all ${
                            isExpanded ? 'text-white' : 'bg-gray-50 hover:bg-indigo-50 text-gray-700'
                          }`}
                        >
                          {!isExpanded && (
                            <div 
                              className="w-full h-1 mb-2 rounded-full" 
                              style={{ backgroundColor: rangeColor }}
                            />
                          )}
                          <span className="font-bold text-lg">{range.label}</span>
                          <span className={`text-xs ${isExpanded ? 'text-white/80' : 'text-gray-400'}`}>
                            {bookedInRange > 0 ? `${bookedInRange}/16 slots booked` : 'Available'}
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="flex flex-col bg-white animate-in slide-in-from-top-2 duration-200">
                            {rangeSlots.map(slotId => {
                              const isBooked = !!bookings[slotId];
                              const isSelected = selectedSlots.includes(slotId);
                              const timeStr = format(parseISO(slotId), 'HH:mm');
                              
                              return (
                                <div
                                  key={slotId}
                                  onMouseDown={() => handleMouseDown(slotId)}
                                  onMouseEnter={() => handleMouseEnter(slotId)}
                                  className={`
                                    h-11 border-b border-gray-50 flex items-center justify-center cursor-pointer select-none transition-colors
                                    ${isBooked ? 'bg-red-50 cursor-not-allowed' : ''}
                                    ${isSelected ? 'bg-indigo-500 text-white' : 'hover:bg-indigo-50 text-gray-600'}
                                  `}
                                >
                                  <div className="text-sm font-medium">
                                    {isBooked ? (
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] uppercase text-red-300 font-bold">{timeStr}</span>
                                        <span className="text-xs text-red-600 font-bold">{bookings[slotId]}</span>
                                      </div>
                                    ) : (
                                      <span>{timeStr}</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {selectedSlots.length > 0 && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 w-full max-w-md animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-lg font-bold mb-2">Book {selectedSlots.length} slot(s)?</h3>
            <p className="text-sm text-gray-500 mb-4">
              {format(parseISO(selectedSlots[0]), 'MMM d, HH:mm')} - {format(addMinutes(parseISO(selectedSlots[selectedSlots.length - 1]), 30), 'HH:mm')}
            </p>
            <div className="flex gap-3">
              <button 
                onClick={clearSelection}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={finalizeBooking}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold"
              >
                Confirm Booking
              </button>
            </div>
          </div>
        )}

        {showNameModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl">
              <h2 className="text-2xl font-bold mb-4">What's your name?</h2>
              <p className="text-gray-600 mb-6">We'll remember you for next time!</p>
              <input 
                autoFocus
                type="text" 
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && finalizeBooking()}
                placeholder="Enter your name"
                className="w-full px-4 py-3 border-2 border-indigo-100 rounded-xl mb-6 focus:border-indigo-500 outline-none transition-colors"
              />
              <button 
                onClick={finalizeBooking}
                disabled={!nameInput.trim()}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50"
              >
                Save & Book
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
