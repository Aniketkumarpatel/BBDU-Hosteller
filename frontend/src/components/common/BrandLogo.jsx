/**
 * The BBDUHOSTELLER wordmark (DEC-033): one rectangle, split into a solid red half with white
 * letters and a white half with red letters, sitting on a pencil-hatched shadow that is offset
 * down and to the right so it looks hand shaded. Text is real text, so it follows the app font
 * and stays sharp at any size. Decorative container; the name is the accessible label.
 */
const HATCH =
  'repeating-linear-gradient(135deg, #a32337 0px, #a32337 1.5px, #e8364f 1.5px, #e8364f 3.5px)';

export default function BrandLogo({ className = '' }) {
  return (
    <span role="img" aria-label="BBDU Hosteller" className={`relative inline-flex ${className}`}>
      <span aria-hidden="true" className="absolute inset-0 translate-x-[3px] translate-y-[3px] rounded-lg" style={{ backgroundImage: HATCH }} />
      <span
        aria-hidden="true"
        className="relative flex overflow-hidden rounded-lg border-2 border-brand-700 bg-white text-[13px] font-extrabold leading-none tracking-wide sm:text-base"
      >
        <span className="bg-linear-to-b from-brand-500 to-brand-700 px-2 py-2 text-white sm:px-2.5">BBDU</span>
        <span className="px-2 py-2 text-brand-700 sm:px-2.5">HOSTELLER</span>
      </span>
    </span>
  );
}
