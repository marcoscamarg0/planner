import { createClient } from "@/lib/supabase/server";
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, isToday, parseISO, startOfWeek, endOfWeek, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock, CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const resolvedSearchParams = await searchParams;
  const targetDate = resolvedSearchParams.month ? new Date(resolvedSearchParams.month) : new Date();
  
  // Get all tasks with a due date
  const { data: tasks } = await supabase
    .from("tasks")
    .select(`*, projects(id, title, color)`)
    .not("due_date", "is", null)
    .order("due_date", { ascending: true });

  const tasksList = tasks || [];

  // Calendar logic
  const monthStart = startOfMonth(targetDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const dateFormat = "d";
  const days = eachDayOfInterval({
    start: startDate,
    end: endDate
  });

  const nextMonth = format(addMonths(monthStart, 1), 'yyyy-MM-dd');
  const prevMonth = format(subMonths(monthStart, 1), 'yyyy-MM-dd');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <CalendarIcon className="w-8 h-8 text-primary" />
            Calendário de Prazos
          </h1>
          <p className="text-muted-foreground mt-2">Visão executiva das entregas e marcos importantes.</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/calendar?month=${prevMonth}`} className="px-4 py-2 bg-card border border-border rounded-lg hover:bg-accent text-sm font-medium transition-colors">
            Mês Anterior
          </Link>
          <Link href={`/calendar?month=${nextMonth}`} className="px-4 py-2 bg-card border border-border rounded-lg hover:bg-accent text-sm font-medium transition-colors">
            Próximo Mês
          </Link>
        </div>
      </div>

      <div className="glass rounded-2xl p-6 border border-white/5">
        <h2 className="text-xl font-bold text-foreground mb-6 capitalize">
          {format(monthStart, 'MMMM yyyy', { locale: ptBR })}
        </h2>

        {/* Days of week header */}
        <div className="grid grid-cols-7 mb-4">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
            <div key={day} className="text-center text-sm font-semibold text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2 md:gap-4">
          {days.map((day, i) => {
            const dayTasks = tasksList.filter(t => t.due_date && isSameDay(parseISO(t.due_date), day));
            const isCurrentMonth = format(day, 'M') === format(monthStart, 'M');
            
            return (
              <div 
                key={day.toString()} 
                className={`min-h-[100px] p-2 rounded-xl border ${!isCurrentMonth ? 'opacity-40 bg-background/50 border-transparent' : 'bg-card/50 border-border/50'} ${isToday(day) ? 'ring-2 ring-primary border-transparent' : ''} transition-all`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-sm font-bold ${isToday(day) ? 'text-primary' : 'text-foreground'}`}>
                    {format(day, dateFormat)}
                  </span>
                  {dayTasks.length > 0 && (
                    <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-md font-bold">
                      {dayTasks.length}
                    </span>
                  )}
                </div>
                
                <div className="space-y-1.5 overflow-y-auto max-h-[80px] custom-scrollbar">
                  {dayTasks.map(task => (
                    <div 
                      key={task.id} 
                      className={`text-xs p-1.5 rounded-md flex items-center gap-1.5 truncate ${task.status === 'done' ? 'opacity-50 line-through' : ''}`}
                      style={{ 
                        backgroundColor: `${task.projects?.color}15`,
                        color: task.projects?.color || 'currentColor',
                        borderLeft: `2px solid ${task.projects?.color || '#fff'}`
                      }}
                    >
                      {task.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Upcoming List */}
      <div className="mt-8">
        <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-400" /> 
          Próximos Prazos (Visão em Lista)
        </h3>
        <div className="glass rounded-xl divide-y divide-border/50">
          {tasksList.filter(t => new Date(t.due_date) >= new Date()).slice(0, 10).map(task => (
            <div key={task.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3">
                {task.status === 'done' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Circle className="w-5 h-5 text-muted-foreground" />}
                <div>
                  <p className={`text-sm font-semibold ${task.status === 'done' ? 'line-through opacity-50' : 'text-foreground'}`}>
                    {task.title}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: task.projects?.color }} />
                    {task.projects?.title}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-sm font-bold ${isSameDay(parseISO(task.due_date), new Date()) ? 'text-rose-400' : 'text-muted-foreground'}`}>
                  {format(parseISO(task.due_date), "dd 'de' MMM", { locale: ptBR })}
                </span>
              </div>
            </div>
          ))}
          
          {tasksList.filter(t => new Date(t.due_date) >= new Date()).length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Nenhum prazo futuro encontrado. Adicione datas nas suas demandas.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
