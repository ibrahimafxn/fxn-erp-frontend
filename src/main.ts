import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { AppConfig } from './app/app.config';
import { App } from './app/app';
import { authInterceptor } from './app/core/interceptors/auth.interceptor';

bootstrapApplication(App, {
  providers: [
    provideRouter(AppConfig.routes),
    provideHttpClient(
      withInterceptors([authInterceptor])
    ),
    ...AppConfig.providers,
  ]
}).catch(err => console.error(err));
