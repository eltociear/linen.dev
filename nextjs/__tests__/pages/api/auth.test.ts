import handler from '../../../pages/api/auth';
import { create } from '../../factory';
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../client';
import { sendNotification } from '../../../services/slack';
import ApplicationMailer from '../../../mailers/ApplicationMailer';

jest.mock('../../../client');
jest.mock('../../../services/slack');
jest.mock('../../../mailers/ApplicationMailer');

describe('auth', () => {
  describe('#create', () => {
    it('creates a new auth', async () => {
      const request = create('request', {
        method: 'POST',
        body: {
          email: 'john@doe.com',
          password: '123456',
        },
      }) as NextApiRequest;
      const response = create('response') as NextApiResponse;
      (prisma.auths.findFirst as jest.Mock).mockResolvedValue(null);
      await handler(request, response);
      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith({
        message: 'Account created, please sign in!',
      });
    });

    it('sends a notification', async () => {
      const request = create('request', {
        method: 'POST',
        body: {
          email: 'john@doe.com',
          password: '123456',
        },
      }) as NextApiRequest;
      const response = create('response') as NextApiResponse;
      (prisma.auths.findFirst as jest.Mock).mockResolvedValue(null);
      await handler(request, response);
      expect(sendNotification).toHaveBeenCalledWith(
        'Email created: john@doe.com'
      );
    });

    it.skip('sends a verification email', async () => {
      const request = create('request', {
        method: 'POST',
        body: {
          email: 'john@doe.com',
          password: '123456',
        },
      }) as NextApiRequest;
      const response = create('response') as NextApiResponse;
      (prisma.auths.findFirst as jest.Mock).mockResolvedValue(null);
      await handler(request, response);
      expect(ApplicationMailer.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'john@doe.com',
          subject: 'Linen.dev - Verification email',
        })
      );
    });

    describe('when auth already exists', () => {
      it('returns a 200', async () => {
        const request = create('request', {
          method: 'POST',
          body: {
            email: 'john@doe.com',
            password: '123456',
          },
        }) as NextApiRequest;
        const response = create('response') as NextApiResponse;
        (prisma.auths.findFirst as jest.Mock).mockResolvedValue(null);
        await handler(request, response);
        (prisma.auths.findFirst as jest.Mock).mockResolvedValue({});
        await handler(request, response);
        expect(response.status).toHaveBeenCalledWith(200);
        expect(response.json).toHaveBeenCalledWith({
          message: 'Account exists, please sign in!',
        });
      });
    });

    describe('when email is missing', () => {
      it('returns an error', async () => {
        const request = create('request', {
          method: 'POST',
        }) as NextApiRequest;
        const response = create('response') as NextApiResponse;
        await handler(request, response);
        expect(response.status).toHaveBeenCalledWith(400);
        expect(response.json).toHaveBeenCalledWith({
          error: 'Please provide email',
        });
      });
    });

    describe('when password is missing', () => {
      it('returns an error', async () => {
        const request = create('request', {
          method: 'POST',
          body: {
            email: 'john@doe.com',
          },
        }) as NextApiRequest;
        const response = create('response') as NextApiResponse;
        await handler(request, response);
        expect(response.status).toHaveBeenCalledWith(400);
        expect(response.json).toHaveBeenCalledWith({
          error: 'Please provide password',
        });
      });
    });

    describe('when password has less than 6 characters', () => {
      it('returns an error', async () => {
        const request = create('request', {
          method: 'POST',
          body: {
            email: 'john@doe.com',
            password: '1234',
          },
        }) as NextApiRequest;
        const response = create('response') as NextApiResponse;
        await handler(request, response);
        expect(response.status).toHaveBeenCalledWith(400);
        expect(response.json).toHaveBeenCalledWith({
          error: 'Password too short',
        });
      });
    });
  });
});
