import { Component, OnInit, Output, EventEmitter, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Aside } from './aside/aside';
import { Main } from './main/main';
import { User, Post, PostApplicant } from '../models/post.model';
import { DatabaseService } from '../services/database';
import { forkJoin, map, switchMap, of, catchError, take, Subscription } from 'rxjs';

// Define interface for the combined data
interface ApplicationWithPost extends PostApplicant {
  postDetails?: Post;
}

declare var lucide: any;

@Component({
  selector: 'app-ayudante',
  imports: [Aside, Main, CommonModule],
  templateUrl: './ayudante.html',
  styleUrl: './ayudante.css',
})
export class Ayudante implements OnInit {
  private dbService = inject(DatabaseService);
  private cd = inject(ChangeDetectorRef);
  private appsSubscription: Subscription | undefined;

  // Logic for white hands
  appliedPostIds = new Set<string>();

  // Data for Contador screen
  myApplications: ApplicationWithPost[] = [];

  ngOnInit(): void {
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  private searchTerm: string = "";
  private searchCategory: string = "publicaciones";
  public showLogin = false;
  isSidebarOpen: boolean = false;
  currentScreen = "llamados";
  currentUser: User | undefined = undefined;

  @Output() category = new EventEmitter<string>();
  @Output() logout = new EventEmitter<void>();

  filterSearch(event: Event) {
    const query = (event.target as HTMLInputElement).value.toLowerCase();
    this.searchTerm = query;
  }

  setcategory(event: Event) {
    this.searchCategory = (event.target as HTMLSelectElement).value;
  }

  getSearch() { return this.searchTerm; }
  getcategory() { return this.searchCategory; }
  setModalLoginTrue() { this.showLogin = true; }
  setModalLoginFalse() { this.showLogin = false; }
  setLoggedPage(event: string) { this.category.emit(event); }

  changeScreen(event: string) {
    this.currentScreen = event;
    setTimeout(() => {
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }, 100);
  }

  getUser(event: User | undefined) {
    this.currentUser = event;

    if (this.currentUser && this.currentUser.uid) {
      this.loadUserApplications(this.currentUser.uid);
    } else {
      this.myApplications = [];
      this.appliedPostIds.clear();
    }
  }

  // --- FIXED: LOAD IDS AND DETAILS IN ONE GO ---
  loadUserApplications(userId: string) {
    console.log("🔄 Loading applications for user:", userId);

    this.appsSubscription = this.dbService.getUserApplications(userId).pipe(
      switchMap(apps => {
        // 1. Update the Set for "White Hands" logic immediately
        this.appliedPostIds.clear();
        apps.forEach(app => {
          if (app.postId) this.appliedPostIds.add(app.postId);
        });

        // If no apps, return empty list to clear screen
        if (apps.length === 0) {
          return of([]);
        }

        // 2. Fetch Post Details for each application (for the Cards)
        const tasks = apps.map(app =>
          this.dbService.getPostById(app.postId).pipe(
            take(1),
            map(post => {
              // If post is deleted (null), we return null to filter it out later
              if (!post) return null;
              return {
                ...app,
                postDetails: post
              } as ApplicationWithPost;
            }),
            catchError(e => {
              console.error(`Error fetching details for post ${app.postId}`, e);
              return of(null);
            })
          )
        );

        return forkJoin(tasks);
      })
    ).subscribe({
      next: (fullData) => {
        // 3. Filter out nulls (deleted posts) and update the Grid Data
        // 'fullData' is typed as (ApplicationWithPost | null)[] here, so we cast the result
        const validData = fullData.filter(item => item !== null) as ApplicationWithPost[];

        this.myApplications = validData;

        console.log("✅ Data ready for Contador screen:", this.myApplications);

        // 4. Force View Update
        this.cd.detectChanges();

        // 5. Re-render icons for the new cards
        setTimeout(() => { if (typeof lucide !== 'undefined') lucide.createIcons(); }, 100);
      },
      error: (err) => console.error("Error loading user apps:", err)
    });
  }

  async cancelApplication(postId: string) {
    if (!this.currentUser) return;

    const confirmCancel = confirm("¿Estás seguro de cancelar esta postulación?");
    if (!confirmCancel) return;

    try {
      await this.dbService.removeApplicant(postId, this.currentUser.uid);

      // Optimistic updates
      this.myApplications = this.myApplications.filter(app => app.postId !== postId);
      this.appliedPostIds.delete(postId);

      this.cd.detectChanges(); // Update view
    } catch (error) {
      console.error("Error cancelling:", error);
    }
  }

  getContactLink(phone: string | undefined, title: string | undefined) {
    const safePhone = phone || '521';
    const safeTitle = title || 'tu publicación';
    const text = `Hola, te contacto por "${safeTitle}" en YoMeSumo.`;
    return `https://wa.me/${safePhone}?text=${encodeURIComponent(text)}`;
  }

  logOut() {
    localStorage.removeItem('userid');
    this.logout.emit();
  }
}