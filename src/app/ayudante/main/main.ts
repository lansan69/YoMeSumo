import { CommonModule } from '@angular/common';
import { Component, inject, Input } from '@angular/core'; // Removed OnChanges, SimpleChanges
import { Observable, BehaviorSubject, combineLatest, map } from 'rxjs';

import { DatabaseService } from '../../services/database';
import { Post, Association, User, PostApplicant } from '../../models/post.model';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './main.html',
  styleUrl: './main.css',
})
export class Main {
  private dbService = inject(DatabaseService);
  appliedPostIds = new Set<string>();
  // --- 1. Inputs converted to Setters for Reactivity ---
  
  // Backing field for currentUser so we can access it in toggleFavorite
  private _currentUser: User | undefined;
  selectedPost: Post | null = null;
  
  @Input() set currentUser(val: User | undefined) {
    this._currentUser = val;
    this.currentUser$.next(val); // <--- Updates pipeline immediately
    console.log("Main Component received user:", val); 
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

  // 2. Subjects
  private searchTerm$ = new BehaviorSubject<string>('');
  private favDelimitation$ = new BehaviorSubject<boolean>(false);
  private currentUser$ = new BehaviorSubject<User | undefined>(undefined);

  // 3. Raw Data
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
    // Safety check using the getter
    if (!this.currentUser || !this.currentUser.uid || !post.id) {
      alert('Debes iniciar sesión para guardar favoritos');
      return;
    }

    const userId = this.currentUser.uid;
    const postId = post.id;

    try {
      if (this.isFavorite(postId)) {
        await this.dbService.removeFromFavorites(userId, postId);
        console.log('Removed from favorites');
      } else {
        await this.dbService.saveToFavorites(userId, postId);
        console.log('Added to favorites');
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  }

  async addApplicant(post: Post) {
    // A. Validation
    if (!this.currentUser || !this.currentUser.uid || !post.id) {
      alert('Debes iniciar sesión para sumarte a una causa.');
      return;
    }

    if (this.hasApplied(post.id)) {
      alert('Ya te has postulado a esta iniciativa.');
      return;
    }

    // B. Optional: Ask for a short message (Simple Prompt for now)
    const message = prompt("¿Quieres dejar un mensaje al organizador?", "Hola, me gustaría apoyar en esta actividad.");
    if (message === null) return; // User cancelled

    const userId = this.currentUser.uid;
    const postId = post.id;

    // C. Create the Data Object based on your PostApplicant Model
    const applicationData: PostApplicant = {
      uid: userId,
      applicantId: userId, // Redundant but matches your model
      postId: postId,
      helperName: this.currentUser.displayName || 'Usuario',
      helperPhone: this.currentUser.phone || '',
      helperEmail: this.currentUser.email || '',
      message: message,
      status: 'pending',
      timestamp: null // The service adds serverTimestamp()
    };

    try {
      // D. Call Database Service
      await this.dbService.addApplicant(postId, userId, applicationData);

      // E. Update UI immediately (Optimistic update)
      this.appliedPostIds.add(postId);
      console.log('Postulación exitosa');
      console.log(this.appliedPostIds);

    } catch (error) {
      console.error('Error al postularse:', error);
      alert('Hubo un error al intentar sumarte. Intenta de nuevo.');
    }
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

      // Debugging log to see what the pipeline sees
      if(isFavMode && !user) console.warn("Fav mode is ON but User is undefined in pipeline");

      // A. FILTER BY FAVORITES
      if (isFavMode) {
        if (!user || !user.favorites) {
          return []; // Mode is ON but user (or favs) missing -> Empty list
        }
        filtered = filtered.filter(p => p.id && user.favorites.includes(p.id));
      }

      // B. FILTER BY SEARCH
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
      if (isFavMode) return []; // Hide associations in fav mode
      
      if (!term || term.trim() === '') return asoc;

      const lowerTerm = term.toLowerCase();
      return asoc.filter(aso =>
        aso.nameAssociation.toLowerCase().includes(lowerTerm) ||
        aso.description.toLowerCase().includes(lowerTerm) ||
        aso.email.toLowerCase().includes(lowerTerm) ||
        aso.categoria.toLowerCase().includes(lowerTerm)
      );
    })
  )
}