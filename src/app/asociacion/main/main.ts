import { CommonModule } from '@angular/common';
import { Component, inject, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Observable, BehaviorSubject, combineLatest, map } from 'rxjs'; // <--- Import these

import { DatabaseService } from '../../services/database';
import { Post, Association, User } from '../../models/post.model';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './main.html',
  styleUrl: './main.css',
})
export class Main implements OnChanges {
  private dbService = inject(DatabaseService);
  currentUser: User | undefined = undefined;

  // 1. Receive the search term
  @Input() favDelimitation: boolean = false;
  @Input() searchterm: string = '';
  @Input() category: string = '';

  // 2. Create a "Subject" to track the search term reactively
  private searchTerm$ = new BehaviorSubject<string>('');
  private favDelimitation$ = new BehaviorSubject<boolean>(false);
  private currentUser$ = new BehaviorSubject<User | undefined>(undefined);

  // 3. Get the raw list from DB (This only happens once)
  private allPosts$ = this.dbService.getPosts();
  private allAssoc$ = this.dbService.getAssociations();

  // 4. Filtered Posts Pipeline
  posts$: Observable<Post[]> = combineLatest([
    this.allPosts$,
    this.searchTerm$,
    this.favDelimitation$,
    this.currentUser$
  ]).pipe(
    map(([posts, term, isFavMode, user]) => {

      let filtered = posts;

      // --- STAGE 1: Filter by Favorites (if enabled) ---
      if (isFavMode) {
        if (!user || !user.favorites) {
          return []; // If mode is ON but no user/favs, return empty
        }
        // Filter: Keep post only if its ID is in the user's favorites array
        // Assuming Post has an 'id' or 'uid' field. Adjust 'p.id' if your model uses 'uid'
        filtered = filtered.filter(p => p.id && user.favorites.includes(p.id));
      }

      // --- STAGE 2: Filter by Search Term ---
      if (!term || term.trim() === '') {
        return filtered;
      }

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

  // 5. Filtered Associations Pipeline
  // (Assuming Favorites logic only applies to Posts. If Asoc can be faved, copy logic above)
  asoc$: Observable<Association[]> = combineLatest([
    this.allAssoc$,
    this.searchTerm$,
    this.favDelimitation$
  ]).pipe(
    map(([asoc, term, isFavMode]) => {

      // Usually, if we are in "Favorites Mode", we might want to hide Associations 
      // unless you also have logic for favorite associations.
      if (isFavMode) {
        return [];
      }

      if (!term || term.trim() === '') {
        return asoc;
      }

      const lowerTerm = term.toLowerCase();

      return asoc.filter(aso =>
        aso.nameAssociation.toLowerCase().includes(lowerTerm) ||
        aso.description.toLowerCase().includes(lowerTerm) ||
        aso.email.toLowerCase().includes(lowerTerm) ||
        aso.categoria.toLowerCase().includes(lowerTerm)
      );
    })
  )

  // 6. Update Subjects when inputs change
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['searchterm']) {
      this.searchTerm$.next(this.searchterm);
    }
    if (changes['favDelimitation']) {
      this.favDelimitation$.next(this.favDelimitation);
    }
    if (changes['currentUser']) {
      this.currentUser$.next(this.currentUser);
    }
  }
}