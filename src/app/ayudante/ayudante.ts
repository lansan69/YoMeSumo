import { Component, OnInit, Output, EventEmitter, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // <--- AGREGADO PARA EDITAR BOTON DE EDITAR
import { Aside } from './aside/aside';
import { Main } from './main/main';
import { User, Post, PostApplicant } from '../models/post.model';
import { DatabaseService } from '../services/database';
import { forkJoin, map, switchMap, of } from 'rxjs';

// Define a combined interface for the view
interface ApplicationWithPost {
  applicant: PostApplicant;
  post: Post;
}
declare var lucide: any;

@Component({
  selector: 'app-ayudante',
  imports: [Aside, Main, CommonModule, FormsModule], //SOLO SE AGREGO FORMSMODULE 
  templateUrl: './ayudante.html',
  styleUrl: './ayudante.css',
})

export class Ayudante implements OnInit {
  constructor(private db: DatabaseService) {} // <--- se agrego esta linea para usar el servicio de base de datos
  ngOnInit(): void {
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }
  private searchTerm: string = "";
  private searchCategory: string = "publicaciones";
  public showLogin = false;
  isSidebarOpen: boolean = false;
  //perfil, llamados, favoritos, contador
  currentScreen = "llamados";
  currentUser: User | undefined = undefined;

  // --- INICIO BLOQUE EDICIÓN (SE AGREGO)---
  isEditingProfile: boolean = false;

  toggleEdit() {
    this.isEditingProfile = !this.isEditingProfile;
  }

  // --- FUNCIÓN DE GUARDADO FINAL ---
  saveProfile() {
    if (!this.currentUser) return; // Seguridad por si acaso

    // 1. Preparamos solo los datos que queremos enviar (para no enviar todo el objeto user)
    const datosAActualizar = {
      phone: this.currentUser.phone,
      about: this.currentUser.about // Recuerda el signo ? en el modelo
    };

    console.log("Enviando a Firebase...", datosAActualizar);

    // 2. Llamamos a tu servicio 'updateUser'
    this.db.updateUser(this.currentUser.uid, datosAActualizar)
      .then(() => {
        // ÉXITO
        console.log('¡Perfil actualizado correctamente!');
        this.isEditingProfile = false; // Cerramos el modo edición
      })
      .catch((error) => {
        // ERROR
        console.error('Error al actualizar perfil:', error);
        alert('Hubo un problema al guardar. Intenta de nuevo.');
      });
  }
  // --- FIN BLOQUE EDICIÓN ---






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
