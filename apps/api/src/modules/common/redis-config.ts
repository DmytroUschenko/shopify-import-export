type RedisConnection = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
};

export function parseRedisConnection(redisUrl: string): RedisConnection {
  const url = new URL(redisUrl);
  const databasePath = url.pathname.replace('/', '');

  return {
    host: url.hostname,
    port: Number(url.port || '6379'),
    username: url.username || undefined,
    password: url.password || undefined,
    db: databasePath ? Number(databasePath) : undefined,
  };
}
