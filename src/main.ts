// main.ts
import {bootstrapApplication} from '@angular/platform-browser';
import {provideRouter} from '@angular/router';
import {provideHttpClient, withInterceptorsFromDi} from '@angular/common/http';

import {App} from './app/app';
import {AppConfig} from './app/app.config';

bootstrapApplication(App, {
  providers: [
    provideRouter(AppConfig.routes),
    provideHttpClient(withInterceptorsFromDi()), // Angular injecte tous les interceptors fournis
    ...AppConfig.providers,
  ]
}).catch(err => console.error(err));
