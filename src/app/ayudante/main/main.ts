import { CommonModule } from '@angular/common';
import { Component, inject, Input } from '@angular/core'; // Removed OnChanges, SimpleChanges
import { Observable, BehaviorSubject, combineLatest, map } from 'rxjs';

import { DatabaseService } from '../../services/database';
import { Post, Association, User } from '../../models/post.model';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './main.html',
  styleUrl: './main.css',
})
export class Main {
  private dbService = inject(DatabaseService);
  
  // --- 1. Inputs converted to Setters for Reactivity ---
  
  // Backing field for currentUser so we can access it in toggleFavorite
  private _currentUser: User | undefined;
  
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

  async addApplicant(post:Post){
    if (!this.currentUser || !this.currentUser.uid || !post.id) {
      alert('Debes iniciar sesión para guardar favoritos');
      return;
    }

    const userId = this.currentUser.uid;
    const postId = post.id;

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