import type { channels, messages, threads } from '@prisma/client';
import request from 'superagent';
import { captureExceptionAndFlush } from 'utilities/sentry';
import { createMessage, createOrUpdateMessage } from 'lib/models';
import { findOrCreateThread, findThread } from 'lib/threads';
import { createManyUsers, findUser } from 'lib/users';
import { createSlug } from 'utilities/util';
import { generateRandomWordSlug } from 'utilities/randomWordSlugs';
import { tsToSentAt } from 'utilities/sentAt';
import {
  UserInfo,
  UserInfoResponseBody,
} from 'types/slackResponses/slackUserInfoInterface';

export const fetchConversations = async (
  channel: string,
  token: string,
  userCursor: string | null = null
) => {
  let url = 'https://slack.com/api/conversations.history?channel=' + channel;
  if (!!userCursor) {
    url += '&cursor=' + userCursor;
  }

  const response = await request
    .get(url)
    .set('Authorization', 'Bearer ' + token);

  return response;
};

export type ConversationHistoryBody = {
  ok: boolean;
  messages: ConversationHistoryMessage[];
  has_more: boolean;
  pin_count?: number;
  channel_actions_ts?: any;
  channel_actions_count?: number;
  response_metadata?: ResponseMetadata;
};

export type ConversationHistoryMessage = {
  type: string;
  subtype?: string;
  ts: string;
  user?: string;
  text: string;
  bot_id?: string;
  bot_link?: string;
  client_msg_id?: string;
  team?: string;
  blocks?: Block[];
  thread_ts?: string;
  reply_count?: number;
  reply_users_count?: number;
  latest_reply?: string;
  reply_users?: string[];
  is_locked?: boolean;
  subscribed?: boolean;
  inviter?: string;
  files?: MessageFile[];
  reactions?: MessageReaction[];
};

export interface MessageReaction {
  name: string;
  users: string[];
  count: number;
}

export interface MessageFile {
  id: string;
  created?: number;
  timestamp?: number;
  name: string;
  title?: string;
  mimetype?: string;
  filetype?: string;
  pretty_type?: string;
  user?: string;
  editable?: boolean;
  size?: number;
  mode?: string;
  is_external?: boolean;
  external_type?: string;
  is_public?: boolean;
  public_url_shared?: boolean;
  display_as_bot?: boolean;
  username?: string;
  url_private: string;
  url_private_download?: string;
  media_display_type?: string;
  thumb_64?: string;
  thumb_80?: string;
  thumb_360?: string;
  thumb_360_w?: number;
  thumb_360_h?: number;
  thumb_480?: string;
  thumb_480_w?: number;
  thumb_480_h?: number;
  thumb_160?: string;
  thumb_720?: string;
  thumb_720_w?: number;
  thumb_720_h?: number;
  thumb_800?: string;
  thumb_800_w?: number;
  thumb_800_h?: number;
  thumb_960?: string;
  thumb_960_w?: number;
  thumb_960_h?: number;
  thumb_1024?: string;
  thumb_1024_w?: number;
  thumb_1024_h?: number;
  original_w?: number;
  original_h?: number;
  thumb_tiny?: string;
  permalink?: string;
  permalink_public?: string;
  is_starred?: boolean;
  has_rich_preview?: boolean;
}

interface MessageBlock {
  team: string;
  channel: string;
  ts: string;
  message: Message;
}

interface Message {
  blocks: Block[];
}

type Block = {
  type: string;
  block_id: string;
  elements: Element[];
};

type Element = {
  type: string;
  elements: Element2[];
};

type Element2 = {
  type: string;
  text: string;
};

type ResponseMetadata = {
  next_cursor: string;
};

export const fetchConversationsTyped = async (
  channel: string,
  token: string,
  userCursor: string | null = null
): Promise<ConversationHistoryBody> => {
  let url = 'https://slack.com/api/conversations.history?channel=' + channel;
  if (!!userCursor) {
    url += '&cursor=' + userCursor;
  }

  const response = await request
    .get(url)
    .set('Authorization', 'Bearer ' + token);

  return response.body;
};

export const fetchMessage = async (
  channel: string,
  token: string,
  messageTs: string
) => {
  let url =
    'https://slack.com/api/conversations.history?channel=' +
    channel +
    '&latest=' +
    messageTs +
    '&limit=1';

  const response = await request
    .get(url)
    .set('Authorization', 'Bearer ' + token);

  return response;
};

export const fetchTeamInfo = async (token: string) => {
  const url = 'https://slack.com/api/team.info';

  const response = await request
    .get(url)
    .set('Authorization', 'Bearer ' + token);

  return response;
};

export const saveMessages = async (
  messages: any[],
  channelId: string,
  externalChannelId: string,
  accountId: string
) => {
  const params = messages
    .filter((message) => message.type === 'message')
    .map((message) => {
      return {
        body: message.text,
        blocks: message.blocks,
        sentAt: new Date(parseFloat(message.ts) * 1000),
        channelId: channelId,
        externalThreadId: message.thread_ts,
        externalUserId: message.user || message.bot_id,
        usersId: null,
      } as any;
    });

  try {
    const messages = [];
    for (let param of params) {
      let threadId: string | null = null;
      if (!!param.externalThreadId) {
        let thread = await findThread(param.externalThreadId);
        threadId = thread?.id || null;
      }
      const user = await findUser(param.externalUserId, accountId);
      param.usersId = user?.id;
      param.threadId = threadId;
      messages.push(await createMessage(param));
    }

    return messages;
  } catch (e) {
    await captureExceptionAndFlush(e);
    console.log(e);
    return null;
  }
};

export async function fetchAndSaveThreadMessages(
  messages: (messages & {
    channel: channels;
    threads: threads | null;
  })[],
  token: string,
  accountId: string
) {
  const repliesPromises = messages.map((m) => {
    if (!!m.threads?.externalThreadId) {
      return fetchReplies(
        m.threads.externalThreadId,
        m.channel.externalChannelId,
        token
      ).then((response) => {
        if (!!response?.body && m.threads?.externalThreadId) {
          const replyMessages = response?.body;
          return saveThreadedMessages(
            replyMessages,
            m.channel.id,
            m.threads.externalThreadId,
            accountId
          );
        }
      });
    }
    return null;
  });

  return await Promise.all(repliesPromises);
}

export async function fetchAndSaveUser(externalUserId: string, token: string) {
  await getUserProfile(externalUserId, token);
}

export async function saveThreadedMessages(
  replies: any,
  channelId: string,
  externalThreadId: string,
  accountId: string
) {
  const repliesParams = replies.messages
    .map((m: any) => {
      return {
        body: m.text,
        sentAt: tsToSentAt(m.ts),
        externalMessageId: m.ts,
        externalUserId: m.user || m.bot_id,
        channelId: channelId,
      };
    })
    .sort((a: any, b: any) => a.sentAt.getTime() - b.sentAt.getTime());

  const firstMessage = repliesParams.length && repliesParams[0];

  let thread = await findOrCreateThread({
    externalThreadId: externalThreadId,
    channelId: channelId,
    sentAt: firstMessage ? firstMessage.sentAt.getTime() : 0,
    slug: createSlug(firstMessage?.text || ''),
  });

  for (let replyParam of repliesParams) {
    const user = await findUser(replyParam.externalUserId, accountId);
    replyParam.usersId = user?.id;
    replyParam.threadId = thread.id;
    try {
      await createOrUpdateMessage(replyParam);
    } catch (e) {
      console.log(e);
      await captureExceptionAndFlush(e);
      continue;
    }
  }
}

export const fetchReplies = async (
  threadTs: string,
  channel: string,
  token: string
) => {
  const url = 'https://slack.com/api/conversations.replies';

  const response = await request
    .get(url + '?channel=' + channel + '&ts=' + threadTs)
    .set('Authorization', 'Bearer ' + token);

  return response;
};

export const fetchFile = async (fileUrl: string, token: string) => {
  if (!token) return await request.get(fileUrl);

  const response = await request
    .get(fileUrl)
    .set('Authorization', 'Bearer ' + token);
  return response;
};

export interface ConversationRepliesBody {
  ok: boolean;
  messages: ConversationRepliesMessage[];
  has_more: boolean;
}

export interface ConversationRepliesMessage {
  client_msg_id?: string;
  type: string;
  text: string;
  user?: string;
  ts: string;
  team?: string;
  blocks?: Block[];
  thread_ts: string;
  reply_count?: number;
  reply_users_count?: number;
  latest_reply?: string;
  reply_users?: string[];
  is_locked?: boolean;
  subscribed?: boolean;
  parent_user_id?: string;
  subtype?: string;
  username?: string;
  icons?: Icons;
  bot_id?: string;
  attachments?: Attachment[];
}

export interface Style {
  code: boolean;
}

export interface Icons {
  image_48: string;
}

export interface Attachment {
  title: string;
  title_link?: string;
  text: string;
  fallback: string;
  from_url?: string;
  service_name?: string;
  id: number;
  original_url?: string;
  footer?: string;
  footer_icon?: string;
  color?: string;
  mrkdwn_in?: string[];
  bot_id?: string;
  app_unfurl_url?: string;
  is_app_unfurl?: boolean;
  app_id?: string;
  ts?: string;
  author_id?: string;
  channel_team?: string;
  channel_id?: string;
  channel_name?: string;
  is_msg_unfurl?: boolean;
  is_reply_unfurl?: boolean;
  message_blocks?: MessageBlock[];
  author_name?: string;
  author_link?: string;
  author_icon?: string;
  author_subname?: string;
}

export const fetchRepliesTyped = async (
  threadTs: string,
  channel: string,
  token: string
): Promise<ConversationRepliesBody> => {
  const url = 'https://slack.com/api/conversations.replies';

  const response = await request
    .get(url + '?channel=' + channel + '&ts=' + threadTs)
    .set('Authorization', 'Bearer ' + token);

  return response.body;
};

export const saveUsers = async (users: any[], accountId: string) => {
  const params = users.map((user) => {
    const profile = user.profile;
    const name =
      profile.display_name ||
      profile.display_name_normalized ||
      profile.real_name ||
      profile.real_name_normalized;
    const profileImageUrl = profile.image_original;
    return {
      displayName: name,
      externalUserId: user.id,
      profileImageUrl,
      accountsId: accountId,
      isBot: user.is_bot,
      isAdmin: user.is_admin || false,
      anonymousAlias: generateRandomWordSlug(),
    };
  });

  const result = await createManyUsers({ data: params, skipDuplicates: true });
};

export const listUsers = async (
  token: string,
  userCursor: string | null = null
) => {
  let url: string = 'https://slack.com/api/users.list';
  if (!!userCursor) {
    url += '?cursor=' + userCursor;
  }

  return await request.get(url).set('Authorization', 'Bearer ' + token);
};

export const getUserProfile = async (userId: string, token: string) => {
  const url = 'https://slack.com/api/users.info?user=' + userId;

  return await request.get(url).set('Authorization', 'Bearer ' + token);
};

export const joinChannel = async (channel: string, token: string) => {
  const url = 'https://slack.com/api/conversations.join';

  const response = await request
    .post(url)
    .send({ channel })
    .set('Authorization', 'Bearer ' + token);

  return response;
};

export const getSlackChannels = async (teamId: string, token: string) => {
  const url =
    'https://slack.com/api/conversations.list?exclude_archived=true&limit=999&';

  const response = await request
    .get(url + 'team_id=' + teamId)
    .set('Authorization', 'Bearer ' + token);

  return response;
};

export const getSlackUser = async (
  userId: string,
  token: string
): Promise<UserInfo> => {
  const url = 'https://slack.com/api/users.info?';

  const response = await request
    .get(url + 'user=' + userId)
    .set('Authorization', 'Bearer ' + token);

  const responseBody = response.body as UserInfoResponseBody;
  return responseBody.user;
};