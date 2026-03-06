import React, { useRef, useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform, animate } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface PricingPlan {
  name: string;
  price: number;
  priceLabel: string;
  features: string[];
  isPopular?: boolean;
  accent: string;
  levels: { card: string; micros: number; color: string }[];
  onGetStarted?: () => void;
  loading?: boolean;
}

interface PricingProps {
  title?: string;
  plans: PricingPlan[];
  className?: string;
  blackCard?: React.ReactNode;
}

const Counter = ({ from, to }: { from: number; to: number }) => {
  const nodeRef = useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    const controls = animate(from, to, {
      duration: 1,
      onUpdate(value) {
        node.textContent = value.toFixed(0);
      },
    });
    return () => controls.stop();
  }, [from, to]);
  return <span ref={nodeRef} />;
};

const PricingHeader = ({ title }: { title: string }) => (
  <div className="text-center mb-8 sm:mb-12 relative z-10">
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="inline-block"
    >
      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white
          bg-gradient-to-r from-[#0F0F12] to-[#141418] px-8 py-4 rounded-xl border-2 border-[#2E2E36]
          shadow-[8px_8px_0px_0px_rgba(232,197,71,0.3),_15px_15px_15px_-3px_rgba(0,0,0,0.3)]
          transform transition-transform hover:translate-x-1 hover:translate-y-1 mb-3 relative font-heading uppercase tracking-wider">
        {title}
      </h1>
      <motion.div
        className="h-1.5 bg-gradient-to-r from-[#E8C547] via-[#E8C547]/60 to-[#E8C547] rounded-full"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.5 }}
      />
    </motion.div>
  </div>
);

const BackgroundEffects = () => (
  <>
    <div className="absolute inset-0">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 bg-[#E8C547]/10 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            scale: [1, 1.5, 1],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      ))}
    </div>
    <div className="absolute inset-0" style={{
      backgroundImage: "linear-gradient(#ffffff03 1px, transparent 1px), linear-gradient(90deg, #ffffff03 1px, transparent 1px)",
      backgroundSize: "20px 20px"
    }} />
  </>
);

const PricingCard = ({
  plan,
  index
}: {
  plan: PricingPlan;
  index: number;
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springConfig = { damping: 15, stiffness: 150 };
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [7, -7]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-7, 7]), springConfig);

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.2 }}
      style={{
        rotateX,
        rotateY,
        perspective: 1000,
      }}
      onMouseMove={(e) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;
        mouseX.set((e.clientX - centerX) / rect.width);
        mouseY.set((e.clientY - centerY) / rect.height);
      }}
      onMouseLeave={() => {
        mouseX.set(0);
        mouseY.set(0);
      }}
      className={`relative w-full bg-[#0F0F12] rounded-xl p-6 border-2 border-[#2E2E36]
          shadow-[6px_6px_0px_0px_rgba(232,197,71,0.15)]
          hover:shadow-[8px_8px_0px_0px_rgba(232,197,71,0.25)]
          transition-all duration-200`}
      data-testid={`card-plan-${plan.price}`}
    >
      <motion.div
        className={cn(
          `absolute -top-4 -right-4 w-16 h-16 
          rounded-full flex items-center justify-center border-2 border-[#2E2E36]
          shadow-[3px_3px_0px_0px_rgba(0,0,0,0.5)]`,
          plan.accent
        )}
        animate={{
          rotate: [0, 10, 0, -10, 0],
          scale: [1, 1.1, 0.9, 1.1, 1],
          y: [0, -5, 5, -3, 0]
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: [0.76, 0, 0.24, 1]
        }}
      >
        <div className="text-center text-white">
          <div className="text-lg font-black data-number">$<Counter from={0} to={plan.price} /></div>
        </div>
      </motion.div>

      <div className="mb-4">
        <h3 className="text-xl font-black text-white mb-2 font-heading uppercase tracking-wider">{plan.name}</h3>
        {plan.isPopular && (
          <motion.span
            className={cn(
              `inline-block px-3 py-1 text-white
              font-bold rounded-md text-xs border-2 border-[#2E2E36]
              shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)]`,
              plan.accent
            )}
            animate={{
              y: [0, -3, 0],
              scale: [1, 1.05, 1]
            }}
            transition={{
              duration: 2,
              repeat: Infinity
            }}
          >
            POPULAR
          </motion.span>
        )}
      </div>

      <div className="mb-3">
        <span className="text-3xl font-black text-white data-number">{plan.priceLabel}</span>
        <span className="text-sm text-[#71717A] ml-1">one-time</span>
      </div>

      <div className="space-y-2 mb-4">
        <div className="text-[10px] text-[#71717A] uppercase tracking-wider font-bold">Card Levels</div>
        {plan.levels.map((level, i) => (
          <motion.div
            key={level.card}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 + index * 0.2 }}
            whileHover={{
              x: 5,
              scale: 1.02,
              transition: { type: "spring", stiffness: 400 }
            }}
            className="flex items-center justify-between gap-2 p-2.5 bg-[#141418] rounded-md border-2 border-[#222228]
                shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]"
          >
            <div className="flex items-center gap-2">
              <motion.span
                whileHover={{ scale: 1.2, rotate: 360 }}
                className="w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] border border-[#222228]"
                style={{ backgroundColor: level.color + '30', color: level.color }}
              >
                ✓
              </motion.span>
              <span className="text-sm font-bold" style={{ color: level.color }}>{level.card}</span>
            </div>
            <span className="text-sm text-[#71717A] data-number">{level.micros} micro{level.micros > 1 ? 's' : ''} per trade</span>
          </motion.div>
        ))}
      </div>

      {plan.features.length > 0 && (
        <div className="space-y-2 mb-4">
          {plan.features.map((feature, i) => (
            <motion.div
              key={feature}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 + index * 0.2 + 0.3 }}
              whileHover={{
                x: 5,
                scale: 1.02,
                transition: { type: "spring", stiffness: 400 }
              }}
              className="flex items-center gap-2 p-2 bg-[#141418] rounded-md border border-[#222228]"
            >
              <span className="text-[#E8C547] text-xs">✓</span>
              <span className="text-sm text-[#A1A1AA]">{feature}</span>
            </motion.div>
          ))}
        </div>
      )}

      <motion.button
        className={cn(
          `w-full py-3 rounded-lg text-white font-black text-sm uppercase tracking-wider
          border-2 border-[#2E2E36] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)]
          hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.5)]
          active:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)]
          transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-heading`,
          plan.accent
        )}
        whileHover={{
          scale: 1.02,
          transition: { duration: 0.2 }
        }}
        whileTap={{
          scale: 0.95,
        }}
        onClick={plan.onGetStarted}
        disabled={plan.loading}
        data-testid={`btn-get-started-${plan.price}`}
      >
        {plan.loading ? 'REDIRECTING...' : 'GET STARTED →'}
      </motion.button>
    </motion.div>
  );
};

export const PricingContainer = ({ title = "Get Your Account", plans, className = "", blackCard }: PricingProps) => {
  return (
    <div className={cn("min-h-screen bg-[#09090B] p-4 sm:p-6 lg:p-8 relative overflow-hidden", className)}>
      <PricingHeader title={title} />
      <BackgroundEffects />

      <div className="w-full max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
        {plans.map((plan, index) => (
          <PricingCard
            key={plan.name}
            plan={plan}
            index={index}
          />
        ))}
      </div>

      {blackCard && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="relative z-10 mt-8"
        >
          {blackCard}
        </motion.div>
      )}
    </div>
  );
};
