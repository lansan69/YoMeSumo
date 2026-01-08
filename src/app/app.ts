import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Asociacion } from "./asociacion/asociacion";
import { Ayudante } from "./ayudante/ayudante";
import { Unlogged } from "./unlogged/unlogged";
import { CommonModule } from '@angular/common'; // 1. Import this

@Component({
  selector: 'app-root',
  imports: [CommonModule, Asociacion, Ayudante, Unlogged],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  // Options: 'unlogged', 'asociacion', 'usuario'
  userStatus: string = 'usuario';

  // Simple function to switch views for testing
  setView(status: string) {
    this.userStatus = status;
  }

  setUserstatus(event:string){
    this.userStatus = event;
  }

  logOut(){
    this.userStatus = "unlogged";
  }
}