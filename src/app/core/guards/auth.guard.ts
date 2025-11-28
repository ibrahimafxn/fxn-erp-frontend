// src/app/core/guards/auth.guard.ts
import { inject } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { from, map, Observable, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * AuthGuard compatible sync/async.
 * Usage: canActivate: [ AuthGuard ]
 */
export function AuthGuard(): boolean | UrlTree | Observable<boolean | UrlTree> {
  const auth = inject(AuthService);
  const router = inject(Router);

  const handleFalse = () => {
    // stocke l'URL courante pour rediriger après login
    const returnUrl = router.url || '/';
    return router.parseUrl(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
  };

  try {
    const result = auth.isLoggedIn();

    // Si boolean -> renvoie direct
    if (typeof result === 'boolean') {
      return result ? true : handleFalse();
    }

    // Si Signal (Angular) -> getter
    if (typeof (result as any)?.value !== 'undefined' && typeof (result as any) === 'object') {
      // signal peut être accédé par result() ou .value ; on essaye result()
      try {
        const val = (result as any)();
        return val ? true : handleFalse();
      } catch {
        // fallback to observable below
      }
    }

    // Sinon on convertit en Observable (Promise ou Observable)
    return from(result as Promise<boolean> | Observable<boolean>).pipe(
      map(logged => logged ? true : handleFalse())
    );
  } catch (err) {
    console.error('AuthGuard error', err);
    return handleFalse();
  }
}
