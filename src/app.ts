/* eslint-disable @typescript-eslint/no-unused-vars */
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Application, NextFunction, Request, Response } from 'express';
import morgan from 'morgan';
import routes from './app/routes';
import { globalErrorHandler, notFoundHandler } from './app/utils';

// app
const app: Application = express();

// cors
app.use(
  cors({
    // credentials: true,
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:5173',
    ],
  })
);

//parser
app.use(cookieParser());

//logger
app.use(morgan('dev'));
// static files
app.use('/public', express.static('public'));

//body parser
app.use(express.json());

//url encoded parser
app.use(express.urlencoded({ extended: true }));

// All main routes
app.use('/api/v1', routes);

// Testing
app.get('/', (req: Request, res: Response, next: NextFunction) => {
  res.send({ message: 'Server is running like a Rabit!' });
});

// global error handler
app.use(globalErrorHandler);

// all not found handler
app.use(notFoundHandler);

export default app;
