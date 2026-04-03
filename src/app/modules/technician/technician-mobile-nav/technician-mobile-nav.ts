import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-technician-mobile-nav',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './technician-mobile-nav.html',
  styleUrl: './technician-mobile-nav.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TechnicianMobileNav {}
