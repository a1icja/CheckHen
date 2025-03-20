export async function register() {
  const ip = await fetch('https://api.ipify.org').then((res) => res.text());
  await fetch(`https://ntfy.sh/${process.env.NTFY_TOPIC}`, {
    method: 'POST',
    body: ip,
  });
}