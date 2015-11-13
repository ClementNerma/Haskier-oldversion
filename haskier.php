<?php

function json_dir($dir) {
    $json = array();
    $dh   = opendir($dir);

    while($file = readdir($dh)) {
        if($file !== '.' && $file !== '..') {
            if(is_dir($dir . '/' . $file)) {
                $json[$file] = json_dir($dir . '/' . $file);
            } else {
                $json[$file] = file_get_contents($dir . '/' . $file);
            }
        }
    }

    return $json;
}

chdir('haskier');
die(json_encode(json_dir('.')));

?>
