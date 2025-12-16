import { RhosonicsLogo } from "./RhosonicsLogo";

const LoadingScreen = () => {
  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-slate-950">
      {/* Subtle gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900" />
      
      {/* Particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="particle absolute w-1 h-1 bg-primary/40 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${5 + Math.random() * 10}s`,
            }}
          />
        ))}
      </div>
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-6 animate-fade-in">
        {/* Logo with glow */}
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-150" />
          <div className="relative p-5 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-xl shadow-primary/20">
            <RhosonicsLogo size={56} className="text-white" />
          </div>
        </div>
        
        {/* Brand text */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-logo text-white lowercase tracking-tight">
            rhosonics
          </h1>
          <p className="text-[10px] font-data uppercase tracking-[0.25em] text-white/40">
            Production System
          </p>
        </div>
        
        {/* Loading indicator */}
        <div className="flex gap-1.5 mt-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 bg-primary/60 rounded-full animate-pulse"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
      
      {/* Particle animation styles */}
      <style>{`
        @keyframes float-up {
          0% {
            transform: translateY(100vh) scale(0);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-100vh) scale(1);
            opacity: 0;
          }
        }
        .particle {
          animation: float-up linear infinite;
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;
