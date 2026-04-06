// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ErrorHandler, isDevMode } from '@angular/core';
import { inject } from '@vercel/analytics';
import { provideServiceWorker } from '@angular/service-worker';

import { App } from './app/app';
import { AppConfig } from './app/app.config';
import { GlobalErrorHandler } from './app/core/handlers/global-error.handler';

// Initialize Vercel Web Analytics
inject();

bootstrapApplication(App, {
  providers: [
    provideRouter(AppConfig.routes),
    provideHttpClient(withInterceptors(AppConfig.interceptors)),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    }),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ]
}).catch(err => console.error(err));
