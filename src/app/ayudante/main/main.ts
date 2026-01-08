import { CommonModule } from '@angular/common';
import { Component, inject, Input, OnDestroy, ChangeDetectorRef } from '@angular/core'; // Ensure OnDestroy is imported
import { Observable, BehaviorSubject, combineLatest, map, Subscription } from 'rxjs';
import { DatabaseService } from '../../services/database';
import { Post, Association, User, PostApplicant } from '../../models/post.model';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './main.html',
  styleUrl: './main.css',
})
// FIX: Added 'implements OnDestroy' here
export class Main implements OnDestroy {
  private dbService = inject(DatabaseService);
  private cd = inject(ChangeDetectorRef);

  // This Set is what makes the icons stay white (Persistent State)
  appliedPostIds = new Set<string>();

  private appsSubscription: Subscription | undefined;

  // Backing field
  private _currentUser: User | undefined;
  selectedPost: Post | null = null;

  // --- 1. THE LOGIC THAT LOADS PERSISTENT DATA ---
  @Input() set currentUser(val: User | undefined) {
    this._currentUser = val;
    this.currentUser$.next(val);

    // Clean up old subscription
    if (this.appsSubscription) {
      this.appsSubscription.unsubscribe();
    }

    // If user is logged in, fetch their history immediately
    if (val && val.uid) {
      this.loadUserApplications(val.uid);
    } else {
      // If logged out, clear the white hands
      this.appliedPostIds.clear();
    }
  }

  get currentUser(): User | undefined {
    return this._currentUser;
  }

  @Input() set favDelimitation(val: boolean) {
    this.favDelimitation$.next(val);
  }

  @Input() set searchterm(val: string) {
    this.searchTerm$.next(val);
  }

  @Input() category: string = '';

  private searchTerm$ = new BehaviorSubject<string>('');
  private favDelimitation$ = new BehaviorSubject<boolean>(false);
  private currentUser$ = new BehaviorSubject<User | undefined>(undefined);

  private allPosts$ = this.dbService.getPosts();
  private allAssoc$ = this.dbService.getAssociations();

  // --- Helpers & Actions ---

  isFavorite(postId: string | undefined): boolean {
    if (!this.currentUser || !this.currentUser.favorites || !postId) return false;
    return this.currentUser.favorites.includes(postId);
  }

  hasApplied(postId: string | undefined): boolean {
    if (!postId) return false;
    return this.appliedPostIds.has(postId);
  }

  async toggleFavorite(post: Post) {
    if (!this.currentUser || !this.currentUser.uid || !post.id) {
      alert('Debes iniciar sesión para guardar favoritos');
      return;
    }

    const userId = this.currentUser.uid;
    const postId = post.id;

    try {
      if (this.isFavorite(postId)) {
        await this.dbService.removeFromFavorites(userId, postId);
      } else {
        await this.dbService.saveToFavorites(userId, postId);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  }

  async addApplicant(post: Post) {
    // 1. Validation
    if (!this.currentUser || !this.currentUser.uid || !post.id) {
      alert('Debes iniciar sesión para sumarte a una causa.');
      return;
    }

    const userId = this.currentUser.uid;
    const postId = post.id;

    // ======================================================
    // CASE A: REMOVE APPLICATION (Un-apply)
    // ======================================================
    if (this.hasApplied(postId)) {
      // Optional: Confirm with the user
      const confirmDelete = confirm("¿Quieres cancelar tu postulación a esta iniciativa?");
      if (!confirmDelete) return;

      try {
        await this.dbService.removeApplicant(postId, userId);

        // Optimistic UI Update: Remove from Set immediately
        this.appliedPostIds.delete(postId);
        console.log('Postulación cancelada');
      } catch (error) {
        console.error('Error al cancelar:', error);
      }
      return; // Stop here
    }

    // ======================================================
    // CASE B: ADD APPLICATION (Apply)
    // ======================================================

    const message = prompt("¿Quieres dejar un mensaje al organizador?", "Hola, me gustaría apoyar en esta actividad.");
    if (message === null) return;

    const applicationData: PostApplicant = {
      uid: userId,
      applicantId: userId,
      postId: postId,
      helperName: this.currentUser.displayName || 'Usuario',
      helperPhone: this.currentUser.phone || '',
      helperEmail: this.currentUser.email || '',
      message: message,
      status: 'pending',
      timestamp: null
    };

    try {
      await this.dbService.addApplicant(postId, userId, applicationData);

      // Optimistic UI Update: Add to Set immediately
      this.appliedPostIds.add(postId);
      console.log('Postulación exitosa');
    } catch (error) {
      console.error('Error al postularse:', error);
      alert('Hubo un error al intentar sumarte.');
    }
  }

  // --- 2. THE FUNCTION THAT FETCHES FROM DB ---
  loadUserApplications(userId: string) {
    console.log("🔄 Loading applications for user:", userId); // Debug Log 1

    this.appsSubscription = this.dbService.getUserApplications(userId).subscribe(
      (apps) => {
        // Clear and refill the Set
        this.appliedPostIds.clear();

        apps.forEach(app => {
          if (app.postId) {
            this.appliedPostIds.add(app.postId);
          }
        });

        console.log("✅ Applications loaded:", this.appliedPostIds); // Debug Log 2

        // 3. FORCE ANGULAR TO UPDATE THE VIEW
        // This tells Angular: "I changed a Set variable, please repaint the HTML now"
        this.cd.detectChanges();
      }
    );
  }
  openPostDetails(post: Post) {
    this.selectedPost = post;
  }

  closePostDetails() {
    this.selectedPost = null;
  }

  // --- Pipelines ---

  posts$: Observable<Post[]> = combineLatest([
    this.allPosts$,
    this.searchTerm$,
    this.favDelimitation$,
    this.currentUser$
  ]).pipe(
    map(([posts, term, isFavMode, user]) => {
      let filtered = posts;

      if (isFavMode) {
        if (!user || !user.favorites) {
          return [];
        }
        filtered = filtered.filter(p => p.id && user.favorites.includes(p.id));
      }

      if (!term || term.trim() === '') return filtered;

      const lowerTerm = term.toLowerCase();
      return filtered.filter(post =>
        post.title.toLowerCase().includes(lowerTerm) ||
        post.description.toLowerCase().includes(lowerTerm) ||
        post.authorName.toLowerCase().includes(lowerTerm) ||
        (post.suppliesList && post.suppliesList.some(item =>
          item.toLowerCase().includes(lowerTerm)
        ))
      );
    })
  );

  asoc$: Observable<Association[]> = combineLatest([
    this.allAssoc$,
    this.searchTerm$,
    this.favDelimitation$
  ]).pipe(
    map(([asoc, term, isFavMode]) => {
      if (isFavMode) return [];

      if (!term || term.trim() === '') return asoc;

      const lowerTerm = term.toLowerCase();
      return asoc.filter(aso =>
        aso.nameAssociation.toLowerCase().includes(lowerTerm) ||
        aso.description.toLowerCase().includes(lowerTerm) ||
        aso.email.toLowerCase().includes(lowerTerm) ||
        aso.categoria.toLowerCase().includes(lowerTerm)
      );
    })
  );

  ngOnDestroy() {
    if (this.appsSubscription) {
      this.appsSubscription.unsubscribe();
    }
  }
}