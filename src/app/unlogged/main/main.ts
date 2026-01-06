import { CommonModule } from '@angular/common';
import { Component, inject, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Observable, BehaviorSubject, combineLatest, map } from 'rxjs'; // <--- Import these

import { DatabaseService } from '../../services/database';
import { Post, Association } from '../../models/post.model';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './main.html',
  styleUrl: './main.css',
})
export class Main implements OnChanges {
  private dbService = inject(DatabaseService);

  // 1. Receive the search term
  @Input() searchterm: string = '';
  @Input() category:string = '';

  // 2. Create a "Subject" to track the search term reactively
  private searchTerm$ = new BehaviorSubject<string>('');

  // 3. Get the raw list from DB (This only happens once)
  private allPosts$ = this.dbService.getPosts();
  private allAssoc$ = this.dbService.getAssociations();

  // 4. Create the final "filtered" stream
  posts$: Observable<Post[]> = combineLatest([
    this.allPosts$,
    this.searchTerm$
  ]).pipe(
    map(([posts, term]) => {
      // If search is empty, return everything
      if (!term || term.trim() === '') {
        return posts;
      }

      // Normalize search term to lowercase
      const lowerTerm = term.toLowerCase();

      // Filter logic: Check Title, Description, or Author
      return posts.filter(post =>
        // 1. Check basic string fields
        post.title.toLowerCase().includes(lowerTerm) ||
        post.description.toLowerCase().includes(lowerTerm) ||
        post.authorName.toLowerCase().includes(lowerTerm) ||

        // 2. Check the Supplies Array (New)
        // We use safe navigation (post.suppliesList && ...) in case the array is missing
        (post.suppliesList && post.suppliesList.some(item =>
          item.toLowerCase().includes(lowerTerm)
        ))
      );
    })
  );

  asoc$: Observable<Association[]> = combineLatest([
    this.allAssoc$,
    this.searchTerm$
  ]).pipe(
    map(([asoc, term]) =>{
      if (!term || term.trim() === '') {
        return asoc;
      }
      // Normalize search term to lowercase
      const lowerTerm = term.toLowerCase();

      // Filter logic: Check Title, Description, or Author
      return asoc.filter(aso =>
        // 1. Check basic string fields
        aso.nameAssociation.toLowerCase().includes(lowerTerm) ||
        aso.description.toLowerCase().includes(lowerTerm) ||
        aso.email.toLowerCase().includes(lowerTerm) ||
        aso.categoria.toLowerCase().includes(lowerTerm)
      );
    })
  )

  // 5. Detect changes from the Parent and push to our Subject
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['searchterm']) {
      this.searchTerm$.next(this.searchterm);
    }
  }
}