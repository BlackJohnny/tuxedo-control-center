/*!
 * Copyright (c) 2019-2020 TUXEDO Computers GmbH <tux@tuxedocomputers.com>
 *
 * This file is part of TUXEDO Control Center.
 *
 * TUXEDO Control Center is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * TUXEDO Control Center is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with TUXEDO Control Center.  If not, see <https://www.gnu.org/licenses/>.
 */

import { IDisplayFreqRes, IDisplayMode } from '../models/DisplayFreqRes';
import * as child_process from 'child_process';
export class XDisplayRefreshRateController

{
    private displayName: string;
    private isX11: boolean;
    private displayEnvVariable: string;
    private xAuthorityFile: string;
    public XDisplayRefreshRateController()
    {
        this.displayName = "";
        this.setEnvVariables();
    }

    private setEnvVariables()
    {
        let result = child_process.execSync(`who`) + "";
        // output should be all users looking something like this:
        // crissi   tty1         2023-04-05 17:01 (:0)
        // crissi   pts/6        2023-04-11 18:08
        // what we want is the display variable :0 in this case and the username
        // because we need it to find the xauthority file
        // so we iterate through all lines until we find the one with the (:*) at the end
        // ok apparantly it's possible for the IP address to be in the output too
        // should we just ignore this possiblity... well.
        var correctLineRegex = /(\w+)\s+(.+\s+)+(\(:.+\))/ // capturing groups: 1 is user name 2 can be ignored and 3 is the display variable
        var match = result.match(correctLineRegex);
        if(!match)
        {
            // if no match we set this.isX11 to false and be done with it
            this.isX11 = false;
            this.displayEnvVariable="";
            this.xAuthorityFile="";
            return;
        }
        var username = match[1];
        this.displayEnvVariable = match[3].replace("(","").replace(")","");
        this.xAuthorityFile="/home/"+username+"/.Xauthority"
        
    }

    public getWho()  
    {
        return child_process.execSync(`who`) + "";
    }

    public getIsX11()//: boolean 
    {
        return this.isX11;
    }

    // dann get refresh rates oder so (die frage ist, soll es die auflösung gleich mit schicken?)
// wo wir hier die funktion reinbauen, die xrandr's output parsed#
// also die verfügbaren refreshrates plus die derzeit aktive raushaut

// sollen wir einfach als bonus einbauen, dass man die auflösung gleich mit einstellen kann?
// vlt bau ich es einfach mit ein, es dann auszukommentieren ist wirklicht nicht schwer xD
    public getDisplayModes(): IDisplayFreqRes
    {
        if (this.displayEnvVariable === undefined)
        {
            this.setEnvVariables();
        }
        // TODO
        // vermutlich sollte sich diese klasse hier merken, wie der interne bildschirm heißt? bekommt er vom parsen
        // wir suchen nach displays die entweder edp oder lvds (mit eDP-1 bzw LVDS-1) heißen
        // wobei die meisten tuxedo devices edp haben sollten
        let result = child_process.execSync(`export XAUTHORITY=${this.xAuthorityFile} && xrandr -q -display ${this.displayEnvVariable}`) + "";
        
        // ok jetzt parsen, wir wollen alles ab eDO-<int> (welches wir in die variable displayname parsen)
        // bis zur letzten auflösung, die \t<int>x<int>\t<float> ist wobei sich \t<float> beliebig oft wiederholt
        // achso, ein * und + können auch drin sein, die sind nur in soweit wichtig, dass wir die aktive res richtig setzen
        // die aktive res soll dublicate in allen verfügbaren res mit drin sein
        var displayNameRegex = /((eDP\-[0-9]+)|(LVDS\-[0-9]+))/
        // each line consists of one resolutionRegex and one or more freqRegex sepparated by tabs
        // we want everything after displayNameRegex (which we wanna save into displayName variable) 
        // that matches resolutionRegex \t (freqRegex)+
        var resolutionRegex = /\s+[0-9]{3,4}x[0-9]{3,4}[a-z]?/ // matches 1920x1080 (and 1920x1080i because apparantly some resolutions have letters after them AAAAAAHHHHH)
        // wait, does the i at the end of the resolution mean "in use"?
        var freqRegex = /[0-9]{1,3}\.[0-9]{2}[\*]?[\+]?/ // matches 60.00*+  50.00    59.94    59.99 
        var fullLineRegex = /\s+[0-9]{3,4}x[0-9]{3,4}[a-z]?(\s+[0-9]{1,3}\.[0-9]{2}[\*]?[\+]?)+/ // matches 1920x1080     60.00*+  50.00    59.94    59.99 
        
        // or should we use xrandr --listmonitors ? or xrandr --listactivemonitors
        this.displayName = "";

        // pff so we look at each line after displayNameRegex, see if it matches fullLineRegex
        // if yes we put it into our displaymodes
        // if we come across one that has * we ALSO put it in active mode
        // * means active, + means prefered
        // ok wie wäre es wenn wir jede zeile des outputs durchgehen und nach eDP-<int> bzw LVDS-<int> schauen
        // und dann alle zeilen danach parsen, bis die Zeile die wir anschauen nicht mehr dem
        // format <integer>x<integer>(*+)[ \t<int><int>.<int><int> ](mind einmal) entspricht

        // maybe we should split the whole output into an array, on the line breaks and go through it line for line
        // untill we encounter the right display name line
        // then look at every line after and stuff it into the displaymodes array until we land on a line that does not match
        // the regex anymore?
        let lines = result.split("\n");
        let foundDisplayName = false;
            /* 

    just for reference:
    export interface IDisplayFreqRes 
    {
        displayName: string;
        activeMode: IDisplayMode;
        // active Mode is also included in displayModes
        displayModes: IDisplayMode[];
    }

    export interface IDisplayMode
    {
        refreshRates: number[];
        xResolution: number;
        yResolution: number;
    }
    
    */
        let newDisplayModes: IDisplayFreqRes =
        {
            displayName: "",
            activeMode: {
                refreshRates: [],
                xResolution: 0,
                yResolution: 0
            },
            displayModes: []
        };
        for (var i = 0; i < lines.length; i++)
        {
            if(!foundDisplayName)
            {
                let name = lines[i].match(displayNameRegex);
                if(name != null)
                {
                    this.displayName = name[0];
                    foundDisplayName =true;
                    newDisplayModes.displayName = this.displayName;
                    newDisplayModes.displayModes =  [];
                }
            }
            else
            {
                if(lines[i].match(fullLineRegex))
                {
                    let resolution = lines[i].match(resolutionRegex)[0].split("x");
                    let refreshrates = lines[i].match(freqRegex);
                    let newMode:IDisplayMode =
                    {
                        refreshRates: [],
                        xResolution: 0,
                        yResolution: 0
                    }; 
                    newMode.xResolution = parseInt(resolution[0]);
                    newMode.yResolution = parseInt(resolution[1]);
                    newMode.refreshRates = [];
                    for (let i = 0; i < refreshrates.length; i++)
                    {
                    // TODO
                    // look for * and + if they are there remove them
                    // if they are there add mode to the active mode and also to the normal displaymodes
                    // I think, maybe we don't even need to remove the *, in theory, parseFloat should ignore it.
                        newMode.refreshRates.push(parseFloat(refreshrates[i]));
                        if (refreshrates[i].includes("*"))
                        {
                            newDisplayModes.activeMode.refreshRates= [parseFloat(refreshrates[i])];
                            newDisplayModes.activeMode.xResolution = newMode.xResolution;
                            newDisplayModes.activeMode.yResolution = newMode.yResolution;
                        }
                    }
                    newDisplayModes.displayModes.push(newMode);
                }
                else
                {
                    break;
                }
            }
        }

        return newDisplayModes;
    }



// und dann letztendlich eine Funktion, die die refresh rate setzt
    public setRefreshRate(rate: number): void
    {
        child_process.execSync(`export XAUTHORITY=${this.xAuthorityFile} && xrandr -display ${this.displayEnvVariable} --output ${this.displayName} -r ${rate}`);
    }
    public setResolution(xRes: number, yRes: number): void
    {
        child_process.execSync(`export XAUTHORITY=${this.xAuthorityFile} && xrandr -display ${this.displayEnvVariable} --output ${this.displayName} --mode ${xRes}x${yRes}`);
    }

    public setRefreshResolution(rate: number, xRes: number, yRes: number)
    {
        child_process.execSync(`export XAUTHORITY=${this.xAuthorityFile} && xrandr -display ${this.displayEnvVariable} --output ${this.displayName} --mode ${xRes}x${yRes} -r ${rate}`);
    }
}
