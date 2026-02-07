import { useState } from "react";
import { Calendar, Clock, Users, ChevronLeft, ChevronRight, X } from "lucide-react";
import ClassDetailsModal from "./ClassDetailsModal";

const CalendarView = ({ classes, bookings, onBookClass, currentUser }) => {
  const [viewMode, setViewMode] = useState("week"); // "week" or "month"
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedClass, setSelectedClass] = useState(null);

  // Get week dates (Mon-Sun)
  const getWeekDates = (date) => {
    const curr = new Date(date);
    const day = curr.getDay();
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
    
    const monday = new Date(curr.setDate(diff));
    const dates = [];
    
    for (let i = 0; i < 7; i++) {
      const weekDate = new Date(monday);
      weekDate.setDate(monday.getDate() + i);
      dates.push(weekDate);
    }
    
    return dates;
  };

  // Get month details
  const getMonthDays = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const startDay = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    
    return { firstDay, daysInMonth, startDay: startDay === 0 ? 6 : startDay - 1 };
  };

  // Navigate week/month
  const navigatePrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "week") {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "week") {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  // Group classes by day
  const groupClassesByDay = (weekDates) => {
    const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const grouped = {};
    
    weekDates.forEach((date, index) => {
      const dayName = daysOfWeek[index];
      grouped[dayName] = classes.filter(cls => cls.schedule?.day === dayName);
    });
    
    return grouped;
  };

  const weekDates = getWeekDates(currentDate);
  const classesGrouped = groupClassesByDay(weekDates);
  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  // Format date range for display
  const formatWeekRange = () => {
    const start = weekDates[0];
    const end = weekDates[6];
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={navigatePrevious}
            className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="text-center min-w-[200px]">
            <h3 className="text-lg font-bold text-white">
              {viewMode === "week" ? formatWeekRange() : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
          </div>
          
          <button
            onClick={navigateNext}
            className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("week")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              viewMode === "week"
                ? "bg-indigo-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setViewMode("month")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              viewMode === "month"
                ? "bg-indigo-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            Month
          </button>
        </div>
      </div>

      {/* Weekly View */}
      {viewMode === "week" && (
        <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-x-auto">
          <div className="grid grid-cols-7 min-w-[700px]">
            {/* Day Headers */}
            {daysOfWeek.map((day, index) => {
              const date = weekDates[index];
              const isToday = date.toDateString() === new Date().toDateString();
              
              return (
                <div
                  key={day}
                  className={`p-4 border-b border-r border-gray-700 text-center ${
                    isToday ? "bg-indigo-900/30" : ""
                  }`}
                >
                  <div className="font-bold text-white">{day.slice(0, 3)}</div>
                  <div className={`text-sm ${isToday ? "text-indigo-400 font-bold" : "text-gray-400"}`}>
                    {date.getDate()}
                  </div>
                </div>
              );
            })}

            {/* Class Cards */}
            {daysOfWeek.map((day) => {
              const dayClasses = classesGrouped[day] || [];
              
              return (
                <div key={day} className="border-r border-gray-700 min-h-[400px] p-2">
                  {dayClasses.length > 0 ? (
                    <div className="space-y-2">
                      {dayClasses.map((classItem) => {
                        const isBooked = bookings.some(
                          (b) => b.classId === classItem.id && (b.status === "confirmed" || b.status === "attended")
                        );
                        const isFull = classItem.spotsAvailable <= 0;

                        return (
                          <div
                            key={classItem.id}
                            onClick={() => setSelectedClass(classItem)}
                            className={`p-3 rounded-lg border cursor-pointer transition hover:scale-105 ${
                              isBooked
                                ? "bg-green-900/20 border-green-500/50"
                                : isFull
                                ? "bg-gray-800 border-gray-600 opacity-75"
                                : "bg-indigo-900/20 border-indigo-500/50 hover:border-indigo-400"
                            }`}
                          >
                            <div className="flex items-center gap-1 text-xs text-indigo-400 mb-1">
                              <Clock className="w-3 h-3" />
                              <span>{classItem.schedule?.time}</span>
                            </div>
                            <div className="font-bold text-white text-sm mb-1">{classItem.className}</div>
                            <div className="text-xs text-gray-400">{classItem.instructorName}</div>
                            <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                              <Users className="w-3 h-3" />
                              <span>{classItem.currentBookings}/{classItem.maxCapacity}</span>
                            </div>
                            {isBooked && (
                              <div className="text-xs text-green-400 mt-1 font-medium">✓ Booked</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                      No classes
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly View */}
      {viewMode === "month" && (
        <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
          <div className="grid grid-cols-7">
            {/* Day Headers */}
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div key={day} className="p-3 border-b border-r border-gray-700 text-center font-bold text-white bg-gray-800">
                {day}
              </div>
            ))}

            {/* Calendar Days */}
            {(() => {
              const { daysInMonth, startDay } = getMonthDays(currentDate);
              const cells = [];
              
              // Empty cells before first day
              for (let i = 0; i < startDay; i++) {
                cells.push(
                  <div key={`empty-${i}`} className="p-3 border-b border-r border-gray-700 bg-gray-800/50 min-h-[100px]"></div>
                );
              }
              
              // Days of the month
              for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                const dayName = daysOfWeek[date.getDay() === 0 ? 6 : date.getDay() - 1];
                const dayClasses = classes.filter(cls => cls.schedule?.day === dayName);
                const isToday = date.toDateString() === new Date().toDateString();
                
                cells.push(
                  <div
                    key={day}
                    className={`p-3 border-b border-r border-gray-700 min-h-[100px] ${
                      isToday ? "bg-indigo-900/30" : ""
                    }`}
                  >
                    <div className={`text-sm font-bold mb-2 ${isToday ? "text-indigo-400" : "text-white"}`}>
                      {day}
                    </div>
                    {dayClasses.length > 0 && (
                      <div className="text-xs text-gray-400">
                        {dayClasses.length} class{dayClasses.length !== 1 ? 'es' : ''}
                      </div>
                    )}
                  </div>
                );
              }
              
              return cells;
            })()}
          </div>
        </div>
      )}

      {/* Class Details Modal */}
      <ClassDetailsModal
        classData={selectedClass}
        isOpen={!!selectedClass}
        onClose={() => setSelectedClass(null)}
        onBook={() => selectedClass && onBookClass(selectedClass)}
        currentUser={currentUser}
        isBooked={bookings.some(
          (b) => b.classId === selectedClass?.id && (b.status === "confirmed" || b.status === "attended")
        )}
        isFull={selectedClass && selectedClass.spotsAvailable <= 0}
        isOwner={false}
      />
    </div>
  );
};

export default CalendarView;
