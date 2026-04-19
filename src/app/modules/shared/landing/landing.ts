import { Component, ChangeDetectionStrategy, computed, inject, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

type LandingGoogleReview = {
  author: string;
  company: string;
  rating: number;
  publishedLabel: string;
  text: string;
  highlight: string;
};

@Component({
  selector: 'app-landing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './landing.html',
  styleUrls: ['./landing.scss']
})
export class Landing implements OnDestroy {
  private auth = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private reviewsTimer: ReturnType<typeof window.setInterval> | null = null;

  form = this.fb.group({
    email: ['', Validators.required],
    password: ['', Validators.required],
    mfaCode: ['']
  });

  loading = signal(false);
  error = signal<string | null>(null);
  mfaRequired = signal(false);
  showPassword = signal(false);
  activeFocus = signal<'materiels' | 'flotte' | null>(null);
  activeReviewIndex = signal(0);
  reviewsPaused = signal(false);

  readonly googleReviews: LandingGoogleReview[] = [
    {
      author: 'A. Kone',
      company: 'Superviseur terrain',
      rating: 5,
      publishedLabel: 'Avis Google',
      text: 'FXN nous a permis de centraliser les interventions et de mieux suivre les urgences sans perdre du temps entre plusieurs fichiers.',
      highlight: 'Vision claire des interventions'
    },
    {
      author: 'M. Traore',
      company: 'Responsable dépôt',
      rating: 5,
      publishedLabel: 'Avis Google',
      text: 'Le suivi du stock et des mouvements est beaucoup plus simple. On sait rapidement où agir et quelles équipes prioriser.',
      highlight: 'Pilotage du stock en temps réel'
    },
    {
      author: 'K. Fofana',
      company: 'Coordination opérationnelle',
      rating: 5,
      publishedLabel: 'Avis Google',
      text: 'La lecture des performances terrain est immédiate. Le dashboard aide vraiment à prendre des décisions plus rapides.',
      highlight: 'Décisions plus rapides'
    },
    {
      author: 'S. Diallo',
      company: 'Gestion flotte & support',
      rating: 5,
      publishedLabel: 'Avis Google',
      text: 'Entre la flotte, les équipements et les interventions, tout est plus fluide. L’équipe travaille avec une seule source fiable.',
      highlight: 'Une seule source fiable'
    }
  ];

  readonly currentReview = computed(() => this.googleReviews[this.activeReviewIndex()] ?? this.googleReviews[0]);
  readonly reviewStars = computed(() =>
    Array.from({ length: this.currentReview()?.rating ?? 0 }, (_, index) => index)
  );

  constructor() {
    this.auth.ensureSessionReady().subscribe(() => {
      if (this.auth.isAuthenticated()) {
        this.router.navigateByUrl('/app');
      }
    });

    this.startReviewsAutoplay();
  }

  ngOnDestroy(): void {
    this.stopReviewsAutoplay();
  }

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    const credentials = {
      email: String(this.form.value.email || '').trim(),
      password: String(this.form.value.password || ''),
      mfaCode: String(this.form.value.mfaCode || '').trim() || undefined,
      rememberDevice: true
    };

    this.auth.login(credentials).subscribe({
      next: (resp) => {
        this.loading.set(false);
        if (resp?.mfaRequired) {
          this.mfaRequired.set(true);
          return;
        }
        if (resp?.accessToken) {
          this.mfaRequired.set(false);
          this.router.navigateByUrl('/app');
          return;
        }
        this.mfaRequired.set(false);
        this.error.set(resp?.message || 'Connexion refusée.');
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.error?.passwordExpired) {
          this.error.set(err?.error?.message || 'Mot de passe expiré. Utilisez l’accès complet.');
          return;
        }
        if (err?.error?.mfaRequired) {
          this.mfaRequired.set(true);
          this.error.set(err?.error?.message || 'Code MFA requis.');
          return;
        }
        this.mfaRequired.set(false);
        this.error.set(err?.error?.message || 'Identifiants invalides.');
      }
    });
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  toggleFocus(key: 'materiels' | 'flotte'): void {
    this.activeFocus.update((current) => (current === key ? null : key));
  }

  goToApp(): void {
    this.router.navigateByUrl('/app');
  }

  selectReview(index: number): void {
    if (!this.googleReviews.length) return;
    const safeIndex = ((index % this.googleReviews.length) + this.googleReviews.length) % this.googleReviews.length;
    this.activeReviewIndex.set(safeIndex);
  }

  nextReview(): void {
    this.selectReview(this.activeReviewIndex() + 1);
  }

  previousReview(): void {
    this.selectReview(this.activeReviewIndex() - 1);
  }

  pauseReviews(): void {
    this.reviewsPaused.set(true);
  }

  resumeReviews(): void {
    this.reviewsPaused.set(false);
  }

  trackReview(_: number, review: LandingGoogleReview): string {
    return `${review.author}-${review.highlight}`;
  }

  private startReviewsAutoplay(): void {
    this.stopReviewsAutoplay();
    this.reviewsTimer = window.setInterval(() => {
      if (this.reviewsPaused() || this.googleReviews.length < 2) return;
      this.nextReview();
    }, 5000);
  }

  private stopReviewsAutoplay(): void {
    if (this.reviewsTimer !== null) {
      window.clearInterval(this.reviewsTimer);
      this.reviewsTimer = null;
    }
  }
}
