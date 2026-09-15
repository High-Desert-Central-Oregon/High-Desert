import { animate } from "animejs";

/** Loaded only for a visible night sky on a suitable connection. */
export function animateClassicStars(host: HTMLElement) {
  const twinkles = Array.from(
    host.querySelectorAll<HTMLElement>(".classic-star"),
  )
    .filter((star, i) => i % 4 === 0 && star.getClientRects().length > 0)
    .map((star, i) =>
      animate(star, {
        opacity: [0.22 + (i % 3) * 0.1, 0.72 + (i % 4) * 0.07],
        duration: 1800 + (i % 7) * 390,
        delay: (i % 9) * 310,
        alternate: true,
        loop: true,
        ease: "inOutSine",
      }),
    );
  const meteor = host.querySelector<HTMLElement>(".classic-meteor")!;
  let flight: ReturnType<typeof animate> | undefined;
  let timer: ReturnType<typeof setTimeout>;
  const schedule = (first = false) => {
    timer = setTimeout(
      shoot,
      first ? 8000 + Math.random() * 6000 : 20000 + Math.random() * 20000,
    );
  };
  const shoot = () => {
    flight?.revert();
    const { width, height } = host.getBoundingClientRect();
    meteor.style.left = `${width * (0.04 + Math.random() * 0.45)}px`;
    meteor.style.top = `${height * (0.08 + Math.random() * 0.24)}px`;
    const distance = Math.min(width * 0.38, 320);
    flight = animate(meteor, {
      x: [0, distance],
      y: [0, distance * 0.25],
      opacity: [
        { to: 0.9, duration: 160 },
        { to: 0.65, duration: 650 },
        { to: 0, duration: 550 },
      ],
      duration: 1360,
      ease: "linear",
    });
    schedule();
  };
  schedule(true);
  return () => {
    clearTimeout(timer);
    twinkles.forEach((animation) => animation.revert());
    flight?.revert();
    meteor.style.removeProperty("left");
    meteor.style.removeProperty("top");
  };
}
