// main.ts
import { CommonModule } from '@angular/common';
import { Component, inject, Input, Output, OnChanges, SimpleChanges, EventEmitter } from '@angular/core';
import { Observable, BehaviorSubject, combineLatest, map } from 'rxjs';
import { DatabaseService } from '../../services/database';
import { Post, Association } from '../../models/post.model';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [CommonModule], // Ensure CommonModule is imported for *ngIf
  templateUrl: './main.html',
  styleUrl: './main.css',
})
export class Main implements OnChanges {
  private dbService = inject(DatabaseService);

  @Input() searchterm: string = '';
  @Input() category: string = '';
  @Output() loginModal = new EventEmitter<boolean>();

  // --- NEW: State for the Modal ---
  selectedPost: Post | null = null;

  // ... (Your existing Observables code: searchTerm$, allPosts$, posts$, asoc$...) ...
  private searchTerm$ = new BehaviorSubject<string>('');
  private allPosts$ = this.dbService.getPosts();
  private allAssoc$ = this.dbService.getAssociations();

  posts$: Observable<Post[]> = combineLatest([
    this.allPosts$,
    this.searchTerm$
  ]).pipe(
    map(([posts, term]) => {
      if (!term || term.trim() === '') return posts;
      const lowerTerm = term.toLowerCase();
      return posts.filter(post =>
        post.title.toLowerCase().includes(lowerTerm) ||
        post.description.toLowerCase().includes(lowerTerm) ||
        post.authorName.toLowerCase().includes(lowerTerm) ||
        (post.suppliesList && post.suppliesList.some(item => item.toLowerCase().includes(lowerTerm)))
      );
    })
  );

  asoc$: Observable<Association[]> = combineLatest([
    this.allAssoc$,
    this.searchTerm$
  ]).pipe(
    map(([asoc, term]) => {
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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['searchterm']) {
      this.searchTerm$.next(this.searchterm);
    }
  }

  // --- NEW: Modal Functions ---
  openPostDetails(post: Post) {
    this.selectedPost = post;
  }

  closePostDetails() {
    this.selectedPost = null;
  }

  setModalLoginTrue(){
    this.loginModal.emit(true);
  }
}