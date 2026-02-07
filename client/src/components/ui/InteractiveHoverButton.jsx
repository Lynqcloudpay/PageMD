import React from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const InteractiveHoverButton = React.forwardRef(({ text = "Button", className, ...props }, ref) => {
    return (
        <button
            ref={ref}
            type={props.type || "button"}
            className={cn(
                "group relative w-full cursor-pointer overflow-hidden rounded-2xl border border-white/20 bg-white/10 p-4 text-center font-bold shadow-lg backdrop-blur-sm transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]",
                className,
            )}
            {...props}
        >
            <span className="inline-block transition-all duration-500 group-hover:translate-x-12 group-hover:opacity-0 text-white drop-shadow-sm">
                {text}
            </span>
            <div className="absolute inset-0 z-10 flex items-center justify-center gap-3 text-white opacity-0 translate-x-[-1.5rem] transition-all duration-500 group-hover:translate-x-0 group-hover:opacity-100">
                <span className="drop-shadow-sm">{text}</span>
                <ArrowRight className="w-5 h-5 drop-shadow-sm animate-pulse-subtle" />
            </div>

            {/* Premium Shimmer/Glow Inner Effect */}
            <div className="absolute inset-0 translate-y-full bg-gradient-to-t from-white/20 via-white/5 to-transparent transition-transform duration-500 group-hover:translate-y-0" />

            {/* Magnetic Glow Spot */}
            <div className="absolute -left-[10%] -top-[10%] h-4 w-4 scale-0 rounded-full bg-white/40 blur-2xl transition-all duration-700 group-hover:left-[50%] group-hover:top-[50%] group-hover:scale-[20] group-hover:opacity-0" />
        </button>
    );
});

InteractiveHoverButton.displayName = "InteractiveHoverButton";

export { InteractiveHoverButton };
