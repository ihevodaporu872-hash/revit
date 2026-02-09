import type { Variants, Transition } from 'framer-motion'

// ── Transitions ──────────────────────────────────────────

export const defaultTransition: Transition = {
  duration: 0.3,
  ease: [0.25, 0.1, 0.25, 1],
}

export const springTransition: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
}

export const fastTransition: Transition = {
  duration: 0.15,
  ease: 'easeOut',
}

// ── Fade Variants ────────────────────────────────────────

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: defaultTransition },
}

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: defaultTransition },
}

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -16 },
  visible: { opacity: 1, y: 0, transition: defaultTransition },
}

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: defaultTransition },
}

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 16 },
  visible: { opacity: 1, x: 0, transition: defaultTransition },
}

// ── Scale & Slide ────────────────────────────────────────

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: defaultTransition },
}

export const slideInFromBottom: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: springTransition },
}

// ── Stagger Containers ───────────────────────────────────

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
}

export const staggerContainerSlow: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.15,
    },
  },
}

// ── Hover & Tap ──────────────────────────────────────────

export const hoverScale = { scale: 1.02 }
export const tapScale = { scale: 0.98 }

export const hoverLift = {
  y: -2,
  transition: fastTransition,
}

// ── Page Transition ──────────────────────────────────────

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15, ease: 'easeIn' } },
}

// ── Notification ─────────────────────────────────────────

export const notificationVariants: Variants = {
  initial: { opacity: 0, x: 80, scale: 0.95 },
  animate: { opacity: 1, x: 0, scale: 1, transition: springTransition },
  exit: { opacity: 0, x: 80, scale: 0.95, transition: { duration: 0.2 } },
}

// ── Sidebar Label ────────────────────────────────────────

export const sidebarLabelVariants: Variants = {
  collapsed: { opacity: 0, width: 0, transition: fastTransition },
  expanded: { opacity: 1, width: 'auto', transition: defaultTransition },
}
