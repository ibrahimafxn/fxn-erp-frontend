import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  WritableSignal,
  computed,
  inject,
  signal
} from '@angular/core';
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

type LandingSlide = {
  src: string;
  alt: string;
  label: string;
  categoryLabel: string;
};

@Component({
  selector: 'app-landing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './landing.html',
  styleUrls: ['./landing.scss']
})
export class Landing implements AfterViewInit, OnDestroy {
  private auth = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private el = inject(ElementRef);

  private reviewsTimer: ReturnType<typeof window.setInterval> | null = null;
  private slideshowTimer: ReturnType<typeof window.setInterval> | null = null;
  private kpiObserver: IntersectionObserver | null = null;
  private kpiAnimated = false;

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

  // Reviews
  activeReviewIndex = signal(0);
  reviewsPaused = signal(false);

  // Slideshow
  activeSlideshowIndex = signal(0);
  slideshowPaused = signal(false);

  // KPI animated counters
  kpiTechniciens = signal(0);
  kpiVehicules = signal(0);
  kpiInterventions = signal(0);
  kpiTauxSucces = signal(0);

  readonly slideshowSlides: LandingSlide[] = [
    {
      src: 'assets/slideshow/flotte-1.jpg',
      alt: "Véhicule d'intervention FXN sur chantier fibre optique",
      label: "Flotte d'intervention opérationnelle",
      categoryLabel: 'Flotte'
    },
    {
      src: 'assets/slideshow/flotte-2.jpg',
      alt: 'Camionnette FXN équipée fibre optique',
      label: 'Mobilité et réactivité terrain',
      categoryLabel: 'Flotte'
    },
    {
      src: 'assets/slideshow/materiel-1.jpg',
      alt: 'Équipements fibre optique certifiés',
      label: 'Équipements techniques certifiés',
      categoryLabel: 'Matériels'
    },
    {
      src: 'assets/slideshow/materiel-2.jpg',
      alt: 'Outillage spécialisé fibre optique',
      label: 'Outillage professionnel homologué',
      categoryLabel: 'Matériels'
    },
    {
      src: 'assets/slideshow/epi-1.jpg',
      alt: 'EPI complets sur chantier fibre',
      label: 'Sécurité chantier — conformité totale',
      categoryLabel: 'EPI'
    },
    {
      src: 'assets/slideshow/epi-2.jpg',
      alt: 'Équipements de protection individuelle FXN',
      label: 'Protection individuelle réglementaire',
      categoryLabel: 'EPI'
    }
  ];

  readonly currentSlide = computed(
    () => this.slideshowSlides[this.activeSlideshowIndex()] ?? this.slideshowSlides[0]
  );

  readonly googleReviews: LandingGoogleReview[] = [
    {
      author: 'A. Kone',
      company: 'Superviseur terrain',
      rating: 5,
      publishedLabel: 'Avis Google',
      text: "FXN nous a permis de centraliser les interventions et de mieux suivre les urgences sans perdre du temps entre plusieurs fichiers.",
      highlight: 'Vision claire des interventions'
    },
    {
      author: 'M. Traore',
      company: 'Responsable dépôt',
      rating: 5,
      publishedLabel: 'Avis Google',
      text: "Le suivi du stock et des mouvements est beaucoup plus simple. On sait rapidement où agir et quelles équipes prioriser.",
      highlight: 'Pilotage du stock en temps réel'
    },
    {
      author: 'K. Fofana',
      company: 'Coordination opérationnelle',
      rating: 5,
      publishedLabel: 'Avis Google',
      text: "La lecture des performances terrain est immédiate. Le dashboard aide vraiment à prendre des décisions plus rapides.",
      highlight: 'Décisions plus rapides'
    },
    {
      author: 'S. Diallo',
      company: 'Gestion flotte & support',
      rating: 5,
      publishedLabel: 'Avis Google',
      text: "Entre la flotte, les équipements et les interventions, tout est plus fluide. L'équipe travaille avec une seule source fiable.",
      highlight: 'Une seule source fiable'
    }
  ];

  readonly currentReview = computed(
    () => this.googleReviews[this.activeReviewIndex()] ?? this.googleReviews[0]
  );
  readonly reviewStars = computed(() =>
    Array.from({ length: this.currentReview()?.rating ?? 0 }, (_, i) => i)
  );

  constructor() {
    this.auth.ensureSessionReady().subscribe(() => {
      if (this.auth.isAuthenticated()) {
        this.router.navigateByUrl('/app');
      }
    });

    this.startReviewsAutoplay();
    this.startSlideshowAutoplay();
  }

  ngAfterViewInit(): void {
    const kpiSection = this.el.nativeElement.querySelector('.kpi-dashboard') as HTMLElement | null;

    if (!kpiSection || typeof IntersectionObserver === 'undefined') {
      this.animateAllKpis();
      return;
    }

    this.kpiObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !this.kpiAnimated) {
          this.kpiAnimated = true;
          this.animateAllKpis();
          this.kpiObserver?.disconnect();
        }
      },
      { threshold: 0.25 }
    );

    this.kpiObserver.observe(kpiSection);
  }

  ngOnDestroy(): void {
    this.stopReviewsAutoplay();
    this.stopSlideshowAutoplay();
    this.kpiObserver?.disconnect();
  }

  // ---- Auth ----

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
          this.error.set(err?.error?.message || "Mot de passe expiré. Utilisez l'accès complet.");
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
    this.activeFocus.update((c) => (c === key ? null : key));
  }

  goToApp(): void {
    this.router.navigateByUrl('/app');
  }

  // ---- Reviews ----

  selectReview(index: number): void {
    if (!this.googleReviews.length) return;
    const safe =
      ((index % this.googleReviews.length) + this.googleReviews.length) % this.googleReviews.length;
    this.activeReviewIndex.set(safe);
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

  // ---- Slideshow ----

  selectSlide(index: number): void {
    if (!this.slideshowSlides.length) return;
    const safe =
      ((index % this.slideshowSlides.length) + this.slideshowSlides.length) %
      this.slideshowSlides.length;
    this.activeSlideshowIndex.set(safe);
  }

  nextSlide(): void {
    this.selectSlide(this.activeSlideshowIndex() + 1);
  }

  previousSlide(): void {
    this.selectSlide(this.activeSlideshowIndex() - 1);
  }

  pauseSlideshow(): void {
    this.slideshowPaused.set(true);
  }

  resumeSlideshow(): void {
    this.slideshowPaused.set(false);
  }

  trackSlide(_: number, slide: LandingSlide): string {
    return slide.src;
  }

  handleSlideImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }

  private startSlideshowAutoplay(): void {
    this.stopSlideshowAutoplay();
    this.slideshowTimer = window.setInterval(() => {
      if (this.slideshowPaused() || this.slideshowSlides.length < 2) return;
      this.nextSlide();
    }, 4500);
  }

  private stopSlideshowAutoplay(): void {
    if (this.slideshowTimer !== null) {
      window.clearInterval(this.slideshowTimer);
      this.slideshowTimer = null;
    }
  }

  // ---- KPI Animation ----

  private animateAllKpis(): void {
    this.animateKpi(this.kpiTechniciens, 52, 1800);
    this.animateKpi(this.kpiVehicules, 14, 1600);
    this.animateKpi(this.kpiInterventions, 3800, 2200);
    this.animateKpi(this.kpiTauxSucces, 97, 2000);
  }

  private animateKpi(target: WritableSignal<number>, end: number, duration: number): void {
    const start = performance.now();
    const tick = (now: number): void => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      target.set(Math.round(eased * end));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}
