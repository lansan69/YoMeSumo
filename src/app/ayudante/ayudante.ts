import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Aside } from './aside/aside';
import { Main } from './main/main';
import { User } from '../models/post.model';
declare var lucide: any;

@Component({
  selector: 'app-ayudante',
  imports: [Aside, Main, CommonModule],
  templateUrl: './ayudante.html',
  styleUrl: './ayudante.css',
})

export class Ayudante implements OnInit {
  ngOnInit(): void {
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }
  private searchTerm: string = "";
  private searchCategory: string = "publicaciones";
  public showLogin = false;

  //perfil, llamados, favoritos, contador
  currentScreen = "llamados";
  currentUser: User | undefined = undefined;

  @Output() category = new EventEmitter<string>();
  @Output() logout = new EventEmitter<void>();

  filterSearch(event: Event) {
    const query = (event.target as HTMLInputElement).value.toLowerCase();
    this.searchTerm = query;
  }

  setcategory(event: Event) {
    const selectedValue = (event.target as HTMLSelectElement).value;
    this.searchCategory = selectedValue;
    console.log(this.searchCategory);
  }

  getSearch() {
    return this.searchTerm;
  }

  getcategory() {
    return this.searchCategory;
  }

  setModalLoginTrue() {
    this.showLogin = true;
  }

  setModalLoginFalse() {
    this.showLogin = false;
  }

  setLoggedPage(event: string) {
    console.log("new category from users", event)
    this.category.emit(event);
  }

  changeScreen(event: string){
    this.currentScreen = event;
    setTimeout(() => {
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }, 0);
  }

  getUser(event:User|undefined){
    this.currentUser = event;
  }

  logOut() {
    // Remove the ID so the user is effectively logged out
    localStorage.removeItem('userid');
    console.log('User logged out, ID removed.');

    // Emit the event so the parent component (App) knows to change the view
    this.logout.emit();
  }

}
