export namespace Languages {


    export const translateToJaersk = (word: string) => {
        switch (word) {
            case "jeg":
            case "eg":
                return "æg";
            case "har":
                return "he";
            case "alle":
                return "adle";
            case "greier":
                return "graiø";
            case "ikkje":
                return "kje";
            case "det":
                return "dæ";
            case "deg":
                return "dæg";
            case "gjerne":
            case "gjerna":
                return "gjedna";
            case "mer":
            case "merr":
                return "meir";
            case "glemte":
            case "glømte":
                return "gløymde";
            case "mye":
                return "møye";
            case "hva":
            case "ka":
                return "ke";
            case "d":
            case "det":
                return "dæ";
            case "e":
            case "er":
                return "æ";
            case "dere":
                return "dokke";
            case "oss":
                return "okke";
            case "vår":
                return "okka";
            case "sier":
                return "seie";
            case "samme":
                return "same";
            case "veldig":
                return "grevla";
            case "meg":
                return "mæg";
            case "de":
                return "dei";
            case "hjem":
                return "heim";
            case "hvor":
                return "kor";
            case "hvorfor":
            case "koffor":
                return "keffor"
            case "de":
                return "dei";

            default:
                return word;
        }
    }
}