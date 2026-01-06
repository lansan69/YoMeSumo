import { Component, OnInit, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common'; // Important for displaying data in HTML
import { DatabaseService } from '../../services/database';
import { User } from '../../models/post.model'; // Verify this path matches your file structure

declare var lucide: any;

@Component({
  selector: 'app-aside',
  imports: [CommonModule], // Add CommonModule here
  templateUrl: './aside.html',
  styleUrl: './aside.css',
})
export class Aside implements OnInit {
  // Output: Tell the parent to log out
  @Output() logout = new EventEmitter<void>();
  @Output() screenChange = new EventEmitter<string>();
  @Output() currentUsr = new EventEmitter<User | undefined>();
  // Dependencies
  private dbService = inject(DatabaseService);

  //perfil, llamados, favoritos, contador
  activeView: string = 'llamados';
  // Variable to store the user info
  currentUser: User | undefined;

  ngOnInit(): void {
    this.loadUser();
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  loadUser() {
    // 1. Retrieve the UID from LocalStorage
    const uid = localStorage.getItem('userid');

    // 2. Check if UID exists (user is logged in)
    if (uid) {
      console.log('Found User ID:', uid);

      // 3. Call the service
      this.dbService.getUserById(uid).subscribe({
        next: (userData) => {
          if (userData) {
            // 4. Save the info to your variable
            this.currentUser = userData;
            this.currentUsr.emit(userData);
            console.log('User data loaded:', this.currentUser);
          } else {
            console.warn('User ID exists but no data found in Firestore.');
          }
        },
        error: (err) => {
          console.error('Error fetching user:', err);
        }
      });
    } else {
      console.log('No user logged in.');
    }
  }
  // Helper to get initials
  getInitials(): string {
    if (!this.currentUser || !this.currentUser.displayName) return '?';
    return this.currentUser.displayName.charAt(0).toUpperCase();
  }

  onLogout() {
    this.logout.emit();
  }

  changeActive(viewName: string) {
    this.activeView = viewName; // Update local style
    this.screenChange.emit(viewName); // Tell parent component to change the main content
  }
}