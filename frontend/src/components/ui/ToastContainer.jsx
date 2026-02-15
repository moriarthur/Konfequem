import { AnimatePresence, motion } from "framer-motion";
import Toast from "./Toast";

const toastVariants = {
  enter: {
    opacity: 0,
    y: -20,
    scale: 0.95,
  },
  center: {
    opacity: 1,
    y: 0,
    scale: 1,
  },
  exit: {
    opacity: 0,
    y: -20,
    scale: 0.95,
  },
};

export default function ToastContainer({ toasts, position = "top", onRemove }) {
  return (
    <div className={`fixed left-0 right-0 z-50 flex flex-col gap-2 items-center ${position === "top" ? "top-4" : "bottom-24"} px-4 pointer-events-none`}>
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            variants={toastVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 25,
              opacity: { duration: 0.15 },
            }}
            layout
          >
            <Toast
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
