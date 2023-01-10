import MagicLoginStrategy from 'passport-magic-login';
import UsersService from 'services/users';
import SignInMailer from 'mailers/SignInMailer';

export const magicLinkStrategy = new MagicLoginStrategy({
  secret: process.env.NEXTAUTH_SECRET!,
  callbackUrl: '/api/auth/callback/magic-link',

  // Called with th e generated magic link so you can send it to the user
  // "destination" is what you POST-ed from the client
  // "href" is your confirmUrl with the confirmation token,
  sendMagicLink: async (destination, href, _, req) => {
    try {
      const { host } = req.headers;
      if (!host) {
        throw new Error('Host header is not present');
      }
      const url = host.startsWith('localhost')
        ? `http://${host}${href}`
        : `${host}${href}`;
      const to = destination.split(',').shift()!;
      const result = await SignInMailer.send({
        to,
        url,
      });

      const failed = result?.rejected?.concat(result.pending).filter(Boolean);
      if (failed && failed.length) {
        throw new Error(`Email(s) (${failed.join(', ')}) could not be sent`);
      }
    } catch (error) {
      console.error(error);
    }
  },

  // Once the user clicks on the magic link and verifies their login attempt,
  // you have to match their email to a user record in the database.
  // If it doesn't exist yet they are trying to sign up so you have to create a new one.
  // "payload" contains { "destination": "email" }
  // In standard passport fashion, call callback with the error as the first argument (if there was one)
  // and the user data as the second argument!
  verify: (payload, callback) => {
    const callbackUrl = payload.callbackUrl;
    const state = payload.state;
    const displayName = payload.displayName;

    // Get or create a user with the provided email from the database
    UsersService.getOrCreateUserWithEmail(payload.destination)
      .then((user) => {
        callback(null, {
          id: user.id,
          email: user.email,
          callbackUrl,
          state,
          displayName,
        });
      })
      .catch((err) => {
        callback(err);
      });
  },
  jwtOptions: {
    expiresIn: '5m',
  },
});
