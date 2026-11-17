import "server-only";

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.length < 16) throw new Error(`${name} must be set (min 16 chars)`);
  return v;
}

export const env = {
  get smartIdPepper() {
    return required("SMART_ID_PEPPER");
  },
  get sessionPepper() {
    return required("SESSION_PEPPER");
  },
  get cookieSecure() {
    return process.env.COOKIE_SECURE !== "false";
  },
};
