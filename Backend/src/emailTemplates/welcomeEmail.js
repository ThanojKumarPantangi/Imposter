export function getWelcomeEmail(username) {
  return `
    <div style="font-family: sans-serif; background: #0f172a; color: #fff; padding: 24px; border-radius: 8px;">
      <h2>Welcome to Imposter Game, ${username}!</h2>
      <p>Your guest account has been initialized and linked to this device.</p>
    </div>
  `;
}

export default { getWelcomeEmail };
