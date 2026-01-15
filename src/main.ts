// main.ts
import {bootstrapApplication} from '@angular/platform-browser';
import {provideRouter} from '@angular/router';
import {provideHttpClient, withInterceptorsFromDi} from '@angular/common/http';

import {App} from './app/app';
import {AppConfig} from './app/app.config';
import { isDevMode } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
bootstrapApplication(App, {
  providers: [
    provideRouter(AppConfig.routes),
    provideHttpClient(withInterceptorsFromDi()), // Angular injecte tous les interceptors fournis
    ...AppConfig.providers, provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
          }),
  ]
}).catch(err => console.error(err));
