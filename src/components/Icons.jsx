const paths = {
  arrow: <path d="M7 17 17 7M7 7h10v10" />,
  right: <path d="M4 12h16m-6-6 6 6-6 6" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
    </>
  ),
  moon: <path d="M20.9 13.1A9 9 0 0 1 10.9 3.1 9 9 0 1 0 20.9 13.1Z" />,
  code: <path d="m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18" />,
  pen: <path d="m16 3 5 5-12 12-6 1 1-6L16 3Zm-3 3 5 5" />,
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 22v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
  tools: <path d="M14 3a6 6 0 0 0-7 7L2 15a4 4 0 0 0 6 6l5-5a6 6 0 0 0 8-7l-4 4-6-6 3-4Z" />,
  career: (
    <>
      <rect x="3" y="7" width="18" height="14" rx="2" />
      <path d="M8 7V3h8v4M3 12a25 25 0 0 0 18 0M10 13h4" />
    </>
  ),
  mail: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 5 10 8L22 5" />
    </>
  ),
  github: (
    <path d="M9 19c-4 1-4-2-6-2m12 5v-4a3.5 3.5 0 0 0-1-3c3-.3 6-1.5 6-6a5 5 0 0 0-1.4-3.5A4.6 4.6 0 0 0 18.5 2S17 1.7 14.5 3a12 12 0 0 0-5 0C7 1.7 5.5 2 5.5 2a4.6 4.6 0 0 0-.1 3.5A5 5 0 0 0 4 9c0 4.5 3 5.7 6 6a3.5 3.5 0 0 0-1 3v4" />
  ),
  linkedin: (
    <>
      <rect x="2" y="2" width="20" height="20" rx="3" />
      <path d="M7 10v7m0-10v.1M11 17v-7m0 3c0-4 6-4 6 0v4" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <ellipse cx="12" cy="12" rx="4" ry="10" />
      <path d="M2 12h20" />
    </>
  ),
};

export function Icon({ name = 'code', ...props }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name] || paths.code}
    </svg>
  );
}

export default Icon;
