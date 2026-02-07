import React from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const InteractiveHoverButton = React.forwardRef(({ text = "Button", className, ...props }, ref) => {
    return (
        <button
            ref={ref}
            type={props.type || "button"}
            className={cn(
                "group relative w-full cursor-pointer overflow-hidden rounded-2xl border border-white/20 bg-blue-600 p-4 text-center font-bold shadow-lg transition-all duration-300 hover:shadow-2xl hover:scale-[1.01] active:scale-[0.99] hover:bg-blue-700",
                className,
            )}
            {...props}
        >
            <div className="relative z-10 flex items-center justify-center gap-0 group-hover:gap-3 transition-all duration-300">
                <span className="text-white drop-shadow-sm">
                    {text}
                </span>
                <ArrowRight className="w-0 h-5 text-white opacity-0 group-hover:w-5 group-hover:opacity-100 transition-all duration-300" />
            </div>

            {/* Liquid Shimmer Effect */}
            <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 ease-in-out pointer-events-none" />

            {/* Subtle Glow Overlay */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-white/5 transition-opacity duration-300 pointer-events-none" />
        </button>
    );
});

InteractiveHoverButton.displayName = "InteractiveHoverButton";

export { InteractiveHoverButton };
