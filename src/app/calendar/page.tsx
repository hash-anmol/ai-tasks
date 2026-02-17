import AppFooter from "@/components/AppFooter";

export default function CalendarPage() {
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  return (
    <div className="min-h-screen bg-background-light p-5">
      <h1 className="text-2xl font-bold mb-2">Calendar</h1>
      <p className="text-sm text-slate-500 mb-6">
        {today.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
      </p>

      <div className="grid grid-cols-7 gap-2 text-center">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="text-xs font-bold text-slate-400 py-2">
            {day}
          </div>
        ))}
        {days.map((day, i) => (
          <div
            key={i}
            className={`aspect-square flex items-center justify-center text-sm rounded-lg ${
              day === today.getDate()
                ? "bg-primary text-slate-900 font-bold"
                : day
                ? "bg-white text-slate-700 hover:bg-slate-50"
                : ""
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-bold text-slate-500 mb-3">Upcoming</h2>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="material-icons text-primary text-sm">event</span>
            </div>
            <div>
              <p className="font-medium text-sm">No upcoming events</p>
              <p className="text-xs text-slate-400">All caught up!</p>
            </div>
          </div>
        </div>
      </div>
      <AppFooter />
    </div>
  );
}
