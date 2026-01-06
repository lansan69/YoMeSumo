import { Component, OnInit, Output, EventEmitter, inject, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit, NgZone } from '@angular/core'; import { CommonModule } from '@angular/common';
import { Aside } from './aside/aside';
import { Main } from './main/main';
import { DatabaseService } from '../services/database';
import { Association, Post, PostApplicant } from '../models/post.model';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

declare var lucide: any;
declare var google: any;

@Component({
  selector: 'app-asociacion',
  imports: [Aside, Main, CommonModule, FormsModule],
  templateUrl: './asociacion.html',
  styleUrl: './asociacion.css',
})
export class Asociacion implements OnInit {
  private dbService = inject(DatabaseService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  @ViewChild('addressInput') addressInput!: ElementRef;

  ngOnInit(): void {
    this.refreshIcons();
  }
  ngAfterViewInit(): void {
    this.initAutocomplete();
  }

  newPostForm = {
    title: '',
    description: '',
    supplies: '',
    location: ''
  };

  selectedCoordinates: { lat: number, lng: number } | null = null;

  // State Variables
  searchTerm: string = "";
  searchCategory: string = "publicaciones";
  showLogin = false;
  currentScreen = "llamados";
  currentAssociation: Association | undefined = undefined;

  // Data
  myPosts: Post[] = [];
  postApplicants: { [key: string]: PostApplicant[] } = {};

  @Output() category = new EventEmitter<string>();
  @Output() logout = new EventEmitter<void>();

  filterSearch(event: Event) { this.searchTerm = (event.target as HTMLInputElement).value.toLowerCase(); }
  setcategory(event: Event) { this.searchCategory = (event.target as HTMLSelectElement).value; }
  getSearch() { return this.searchTerm; }
  getcategory() { return this.searchCategory; }

  // asociacion.ts

  changeScreen(event: string) {
    this.currentScreen = event;
    this.refreshIcons();
  }

  getAssociationData(event: Association | undefined) {
    this.currentAssociation = event;
    if (this.currentAssociation && this.currentAssociation.id) {
      this.loadAssociationPosts(this.currentAssociation.id);
    } else {
      this.myPosts = [];
      this.postApplicants = {};
    }
  }

  getPendingCount(postId: string): number {
    const applicants = this.postApplicants[postId] || [];
    // Count only pending or rejected (since those are the ones shown in Publicaciones)
    return applicants.filter(a => a.status !== 'accepted').length;
  }

  loadAssociationPosts(authorId: string) {
    this.dbService.getPostsByAuthor(authorId).subscribe({
      next: (posts) => {
        this.myPosts = posts;
        this.cdr.detectChanges();
        this.myPosts.forEach(post => {
          if (post.id) this.loadApplicantsForPost(post.id);
        });

        this.refreshIcons();
      },
      error: (err) => console.error('Error loading posts:', err)
    });
  }

  loadApplicantsForPost(postId: string) {
    this.dbService.getApplicantsByPostId(postId).subscribe({
      next: (applicants) => {
        // Create a new object reference so Angular detects the change
        this.postApplicants = {
          ...this.postApplicants,
          [postId]: applicants
        };

        // <--- CRITICAL FIX: Manually trigger update when sub-data arrives
        this.cdr.detectChanges();
        this.refreshIcons();
      }
    });
  }

  async updateApplicantStatus(applicant: PostApplicant, newStatus: 'accepted' | 'rejected') {
    if (!applicant.applicantId) return;

    try {
      await this.dbService.updateApplicantStatus(applicant.applicantId, newStatus);
      // The subscription in loadApplicantsForPost will catch the update automatically
      // and trigger the detectChanges() we added above.
    } catch (error) {
      console.error('Error updating status:', error);
    }
  }

  // Helper to refresh icons safely
  refreshIcons() {
    // Use NgZone to run this outside Angular to prevent infinite loops, 
    // but ensure it runs after the current JS tick.
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      }, 50);
    });
  }

  // Helpers
  getWhatsappLink(phone: string, postTitle: string): string {
    const text = `Hola, vi tu solicitud para sumarte a "${postTitle}".`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  }

  openPostIds = new Set<string>();

  togglePost(postId: string | undefined) {
    if (!postId) return;
    if (this.openPostIds.has(postId)) {
      this.openPostIds.delete(postId);
    } else {
      this.openPostIds.add(postId);
    }
    this.refreshIcons(); // Refresh icons when opening accordion
  }

  isPostOpen(postId: string | undefined): boolean {
    return postId ? this.openPostIds.has(postId) : false;
  }

  logOut() {
    // Remove the ID so the user is effectively logged out
    localStorage.removeItem('userid');
    console.log('User logged out, ID removed.');

    // Emit the event so the parent component (App) knows to change the view
    this.logout.emit();
    console.log("logging out");
  }

  async completeCitation(applicant: PostApplicant) {
    if (!applicant.applicantId) return;

    // We reuse the existing update method, just passing 'completed'
    // Ensure your service method allows string or the specific union type
    try {
      await this.dbService.updateApplicantStatus(applicant.applicantId, 'completed');
      // The view will automatically update and remove this card because 
      // the filter looks for 'accepted' only.
    } catch (error) {
      console.error('Error completing citation:', error);
    }
  }

  // 4. NEW: Method to Create the Post
  async createNewPost() {
    if (!this.currentAssociation || !this.currentAssociation.id) {
      console.error('No association logged in');
      return;
    }

    // Basic Validation
    if (!this.newPostForm.title || !this.newPostForm.description) {
      alert('Por favor completa el título y la descripción');
      return;
    }

    // Prepare the object for the DB
    const postData: Partial<Post> = {
      authorId: this.currentAssociation.id,
      authorName: this.currentAssociation.nameAssociation,
      type: 'request', // Defaulting to 'request' based on your template context
      title: this.newPostForm.title,
      description: this.newPostForm.description,
      // Convert string "tape, boxes" -> array ["tape", "boxes"]
      suppliesList: this.newPostForm.supplies.split(',').map(s => s.trim()).filter(s => s !== ''),
      location: {
        address: this.newPostForm.location,
        lat: this.currentAssociation.location.lat, // Fallback to association location
        lng: this.currentAssociation.location.lng  // Fallback to association location
      },
      schedule: 'Por coordinar', // Default value
      status: 'open',
      applicantsCount: 0
    };

    try {
      await this.dbService.createPost(postData);
      console.log('Post created successfully');

      // Reset Form
      this.newPostForm = { title: '', description: '', supplies: '', location: '' };

      // Close Modal
      this.closeEcoModal();

      // Refresh view logic will trigger automatically via subscription
    } catch (error) {
      console.error('Error creating post:', error);
    }
  }

  /**
     * Accepts the applicant:
     * 1. Updates Firestore status to 'accepted'
     * 2. Updates local view to remove the card from 'pending' list
     */
  async acceptApplicant(applicantId: string) {
    try {
      await this.dbService.updateApplicantStatus(applicantId, 'accepted');
      this.updateLocalApplicantStatus(applicantId, 'accepted');
      console.log(`Applicant ${applicantId} accepted successfully.`);
    } catch (error) {
      console.error('Error accepting applicant:', error);
      alert('Hubo un error al aceptar la solicitud.');
    }
  }

  /**
   * Rejects the applicant:
   * 1. Asks for confirmation
   * 2. Updates Firestore status to 'rejected'
   * 3. Updates local view to remove the card
   */
  async rejectApplicant(applicantId: string) {
    const confirmReject = confirm('¿Estás seguro de que deseas rechazar a este sumador?');
    if (!confirmReject) return;

    try {
      await this.dbService.updateApplicantStatus(applicantId, 'rejected');
      this.updateLocalApplicantStatus(applicantId, 'rejected');
      console.log(`Applicant ${applicantId} rejected successfully.`);
    } catch (error) {
      console.error('Error rejecting applicant:', error);
      alert('Hubo un error al rechazar la solicitud.');
    }
  }

  /**
   * Helper function to update the local 'postApplicants' array.
   * This forces the UI to update immediately (hiding the card via *ngIf)
   * without waiting for a page reload.
   */
  private updateLocalApplicantStatus(applicantId: string, newStatus: 'pending' | 'accepted' | 'rejected' | 'completed') {
    // Iterate through all posts in the dictionary
    for (const postId in this.postApplicants) {
      if (this.postApplicants.hasOwnProperty(postId)) {
        // Find the applicant in the specific post's array
        const applicantIndex = this.postApplicants[postId].findIndex(app => app.applicantId === applicantId);

        if (applicantIndex !== -1) {
          // Update the status locally
          this.postApplicants[postId][applicantIndex].status = newStatus;
          // Since the HTML uses *ngIf="applicant.status === 'pending'", 
          // changing it to 'accepted' or 'rejected' will hide it from the list.
          break;
        }
      }
    }
  }

  // 4. GOOGLE MAPS LOGIC
  initAutocomplete() {
    // 1. Check if the Google Maps API is loaded
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
      console.warn("Google Maps API not loaded yet. Retrying in 500ms...");
      setTimeout(() => this.initAutocomplete(), 500);
      return;
    }

    // 2. Check if the input element is available in the DOM
    if (!this.addressInput || !this.addressInput.nativeElement) {
      console.warn("Address Input not found in DOM.");
      return;
    }

    // 3. Initialize
    const autocomplete = new google.maps.places.Autocomplete(this.addressInput.nativeElement, {
      componentRestrictions: { country: 'mx' },
      fields: ['geometry', 'formatted_address'],
      types: ['address'],
    });

    autocomplete.addListener('place_changed', () => {
      this.ngZone.run(() => {
        const place = autocomplete.getPlace();

        if (!place.geometry || !place.geometry.location) {
          window.alert("No details available for input: '" + place.name + "'");
          return;
        }

        this.newPostForm.location = place.formatted_address;
        this.selectedCoordinates = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        };

        console.log("Location Selected:", this.selectedCoordinates);
      });
    });
  }

  showCreateModal = false;

  openEcoModal() {
    this.showCreateModal = true;

    // CRITICAL FIX: Initialize autocomplete ONLY when the modal is opening.
    // We use a small timeout to allow Angular to render the Modal DOM (remove class.hidden)
    // before Maps tries to attach to the input.
    setTimeout(() => {
      this.initAutocomplete();
    }, 100);
  }

  closeEcoModal() { this.showCreateModal = false; }
}