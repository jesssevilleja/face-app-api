import * as winston from 'winston';
import { utilities as nestWinstonModuleUtilities } from 'nest-winston';

export const loggerConfig = {
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.ms(),
        nestWinstonModuleUtilities.format.nestLike('API', {
          colors: true,
          prettyPrint: true,
        }),
      ),
    }),
    // new winston.transports.File({
    //   filename: 'logs/error.log',
    //   level: 'error',
    //   format: winston.format.combine(
    //     winston.format.timestamp(),
    //     winston.format.json(),
    //   ),
    // }),
    // new winston.transports.File({
    //   filename: 'logs/combined.log',
    //   format: winston.format.combine(
    //     winston.format.timestamp(),
    //     winston.format.json(),
    //   ),
    // }),
  ],
};
