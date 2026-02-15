import { AnimatePresence, motion } from "framer-motion";
import Toast from "./Toast";

const toastVariants = {
  enter: (direction) => ({
    x: direction === "top" ? "-50%" : "-50%",
    y: direction === "top" ? -100 : 100,
    opacity: 0,
    scale: 0.9,
  }),
  center: {
    x: "-50%",
    y: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction) => ({
    x: direction === "top" ? "-50%" : "-50%",
    y: direction === "top" ? -100 : 100,
    opacity: 0,
    scale: 0.9,
  }),
};

export default function ToastContainer({ toasts, position = "top", onRemove }) {
  return (
    <div className={`fixed left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center ${position === "top" ? "top-4" : "bottom-24"} w-full px-4 pointer-events-none`}>
      <AnimatePresence mode="popLayout" custom={position}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            custom={position}
            variants={toastVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              opacity: { duration: 0.2 },
            }}
            layout
          >
            <Toast
              id={toast.id}
              message={toast.message}
              type={toast.type}
              duration={toast.duration}
              onClose={() => onRemove(toast.id)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
