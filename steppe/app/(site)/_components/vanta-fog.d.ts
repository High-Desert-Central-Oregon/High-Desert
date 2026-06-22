// Vanta ships no types. We only use the lazy FOG effect (three is the peer), so a
// minimal declaration is enough to keep the build green.
declare module "vanta/dist/vanta.fog.min" {
  const fog: (opts: Record<string, unknown>) => { destroy: () => void };
  export default fog;
}
