import { Throttle } from '@nestjs/throttler';

/**
 * Every route that looks an account up at the bank answers with the holder's name, so each is
 * kept to a human pace; otherwise any of them could be used to enumerate account holders.
 */
export const BankLookupThrottle = () => Throttle({ default: { limit: 10, ttl: 60_000 } });
