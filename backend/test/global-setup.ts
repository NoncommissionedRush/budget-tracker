// Run every test in a UTC+1/+2 zone so local-vs-UTC date bugs show up.
export default function globalSetup() {
  process.env.TZ = 'Europe/Bratislava';
}
