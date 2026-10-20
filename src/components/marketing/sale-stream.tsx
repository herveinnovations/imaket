"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const SALES = [
  { buyer: "Chipo in Lusaka", item: "The Lusaka Budget Planner", method: "MTN MoMo", amount: 150, sym: "K" },
  { buyer: "Emeka in Enugu", item: "Afro Texture Brush Pack", method: "Card", amount: 8500, sym: "₦" },
  { buyer: "Njeri in Nakuru", item: "Golden Hour Presets", method: "M-Pesa", amount: 1500, sym: "KSh " },
  { buyer: "Bwalya in Kitwe", item: "Copperbelt Creatives Summit × 2", method: "Airtel Money", amount: 700, sym: "K" },
  { buyer: "Akosua in Kumasi", item: "Log Drum Essentials", method: "MTN MoMo", amount: 180, sym: "GH₵" },
  { buyer: "Natasha in Ndola", item: "Chitenge Weekender Tote", method: "Zamtel Kwacha", amount: 540, sym: "K" },
  { buyer: "Kondwani in Chipata", item: "Kwacha Investing 101", method: "Airtel Money", amount: 650, sym: "K" },
];

type Sale = (typeof SALES)[number] & { key: number };

/** The hero's single orchestrated motion: sales arriving on a creator's phone. */
export function SaleStream() {
  const reduce = useReducedMotion();
  const [list, setList] = useState<Sale[]>(() => SALES.slice(0, 3).map((s, i) => ({ ...s, key: i })).reverse());
  const [count, setCount] = useState(3);
  const [earned, setEarned] = useState(2340);

  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => {
      setCount((c) => {
        const s = SALES[c % SALES.length];
        setList((l) => [{ ...s, key: c }, ...l].slice(0, 4));
        if (s.sym === "K") setEarned((e) => e + s.amount);
        return c + 1;
      });
    }, 2600);
    return () => clearInterval(t);
  }, [reduce]);

  return (
    <div className="relative mx-auto w-[300px] sm:w-[330px]" aria-label="Example: sales notifications arriving on a creator's phone" role="img">
      <div className="rounded-[2.6rem] border-[10px] border-[#161A33] bg-[#161A33] shadow-lift">
        <div className="relative overflow-hidden rounded-[1.9rem] bg-[#F3F5F2] text-[#161A33]">
          <div className="mx-auto mt-2 h-5 w-24 rounded-full bg-[#161A33]" />
          <div className="px-5 pb-3 pt-5">
            <p className="text-xs text-[#5C637A]">Today in your store</p>
            <motion.p key={earned} initial={reduce ? false : { y: 6, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }}
              className="font-display text-[2.4rem] font-bold leading-none tracking-tight tabular-nums">
              K{earned.toLocaleString("en")}
            </motion.p>
            <p className="mt-1 text-xs font-medium text-[#0B7A56]">{count + 9} sales · withdraw anytime</p>
          </div>
          <ul className="h-[340px] space-y-2 overflow-hidden px-3 pb-4">
            <AnimatePresence initial={false}>
              {list.map((s) => (
                <motion.li key={s.key} layout
                  initial={{ opacity: 0, y: -24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  className="rounded-2xl bg-white p-3.5 shadow-[0_1px_2px_rgb(0_0_0/0.06),0_6px_16px_-8px_rgb(0_0_0/0.18)]">
                  <div className="flex items-center justify-between text-[11px] text-[#5C637A]">
                    <span>Paid with {s.method}</span><span>now</span>
                  </div>
                  <p className="mt-1 text-[13.5px] font-semibold leading-snug">{s.item}</p>
                  <div className="mt-0.5 flex items-center justify-between text-[12.5px]">
                    <span className="text-[#5C637A]">{s.buyer}</span>
                    <span className="font-semibold text-[#0B7A56]">+{s.sym}{s.amount.toLocaleString("en")}</span>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      </div>
    </div>
  );
}
